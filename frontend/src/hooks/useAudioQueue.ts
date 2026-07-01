/**
 * Target path: src/hooks/useAudioQueue.ts (REPLACES existing file)
 *
 * CHANGE IN THIS VERSION
 * ------------------------
 * `setQueue` was returned as an inline arrow function instead of a
 * `useCallback`. Every other function this hook returns (playFromIndex,
 * pause, resume, stop, cleanup) was already memoized -- this one slipped
 * through.
 *
 * Because it wasn't memoized, `setQueue` got a brand new identity every
 * single render. `useExecutiveAssistant`'s `loadBriefing` callback lists
 * `setQueue` in its dependency array, so `loadBriefing` also got a new
 * identity every render. `ExecutiveAssistantShell` has a `useEffect` that
 * re-runs whenever `loadBriefing`'s identity changes and calls
 * `loadBriefing()` again -- which calls your most expensive backend
 * endpoint (full DSS pipeline + 9 LLM calls + 9 TTS generations).
 *
 * Net effect: render -> new setQueue -> new loadBriefing -> effect fires
 * -> loadBriefing() -> state update -> render -> repeat. An infinite loop
 * of full briefing regeneration running continuously in the background
 * for as long as the assistant panel is mounted. This was almost
 * certainly the dominant source of the remaining lag, and likely
 * explains the audio weirdness too (multiple overlapping sessions racing
 * for the same audio element).
 *
 * Fix: wrap setQueue in useCallback with an empty dependency array, same
 * as every other function this hook returns.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DialogueSegment } from '../api/assistantService';

export interface AudioQueueState {
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  queue: DialogueSegment[];
}

export function useAudioQueue() {
  const [state, setState] = useState<AudioQueueState>({
    currentIndex: 0,
    isPlaying: false,
    isPaused: false,
    queue: [],
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.currentTime = 0;
      nextAudioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: false }));
  }, []);

  const playSegment = useCallback(
    async (segment: DialogueSegment, onEnded?: () => void) => {
      if (!segment.audio_url) {
        // No audio available, just signal completion
        setTimeout(() => onEnded?.(), 100);
        return;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Create new audio instance
      const audio = new Audio(segment.audio_url);
      audioRef.current = audio;

      // Pre-fetch next segment in background
      const currentIndex = state.currentIndex;
      const nextSegment = state.queue[currentIndex + 1];
      if (nextSegment?.audio_url && !nextAudioRef.current) {
        const nextAudio = new Audio(nextSegment.audio_url);
        nextAudio.preload = 'auto';
        nextAudioRef.current = nextAudio;
      }

      return new Promise<void>((resolve) => {
        audio.onended = () => {
          audioRef.current = null;
          onEnded?.();
          resolve();
        };

        audio.onerror = () => {
          audioRef.current = null;
          onEnded?.();
          resolve();
        };

        void audio.play().catch(() => {
          audioRef.current = null;
          onEnded?.();
          resolve();
        });
      });
    },
    [state.currentIndex, state.queue],
  );

  const playFromIndex = useCallback(
    async (index: number, queue: DialogueSegment[]) => {
      if (index < 0 || index >= queue.length) {
        setState((prev) => ({ ...prev, isPlaying: false, currentIndex: index }));
        return;
      }

      setState((prev) => ({
        ...prev,
        queue,
        currentIndex: index,
        isPlaying: true,
        isPaused: false,
      }));

      const playNext = async (currentIdx: number) => {
        if (currentIdx >= queue.length) {
          setState((prev) => ({ ...prev, isPlaying: false, currentIndex: queue.length }));
          return;
        }

        setState((prev) => ({ ...prev, currentIndex: currentIdx }));

        await playSegment(queue[currentIdx], () => {
          playNext(currentIdx + 1);
        });
      };

      await playNext(index);
    },
    [playSegment],
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState((prev) => ({ ...prev, isPaused: true, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.play().then(() => {
        setState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
      }).catch(() => {
        setState((prev) => ({ ...prev, isPaused: false, isPlaying: false }));
      });
    } else {
      // If no audio ref, try to resume from current index
      setState((prev) => ({ ...prev, isPaused: false, isPlaying: true }));
    }
  }, []);

  const stop = useCallback(() => {
    stopAll();
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: false, currentIndex: 0 }));
  }, [stopAll]);

  const cleanup = useCallback(() => {
    stopAll();
    if (nextAudioRef.current) {
      nextAudioRef.current = null;
    }
  }, [stopAll]);

  // FIX: this was an inline arrow function before -- new identity every
  // render, which cascaded into loadBriefing/the briefing-generation loop.
  // Now stable for the lifetime of the component, like every other
  // function this hook returns.
  const setQueue = useCallback((queue: DialogueSegment[]) => {
    setState((prev) => ({ ...prev, queue }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    playFromIndex,
    pause,
    resume,
    stop,
    cleanup,
    setQueue,
  };
}