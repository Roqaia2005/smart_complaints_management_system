import React from 'react';
import type { DialogueSegment } from '../api/assistantService';

type QueueStatus = 'idle' | 'playing' | 'paused' | 'ended';

export function useAudioPlaybackQueue(dialogue: DialogueSegment[]) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [status, setStatus] = React.useState<QueueStatus>('idle');

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudio = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    clearTimer();
  }, [clearTimer]);

  const playAt = React.useCallback((index: number) => {
    if (!dialogue.length) return;
    const nextIndex = Math.min(Math.max(index, 0), dialogue.length - 1);
    const segment = dialogue[nextIndex];
    stopAudio();
    setActiveIndex(nextIndex);
    setStatus('playing');

    if (segment.audio_url) {
      const audio = new Audio(segment.audio_url);
      audioRef.current = audio;
      audio.onended = () => {
        if (nextIndex + 1 < dialogue.length) playAt(nextIndex + 1);
        else setStatus('ended');
      };
      audio.onerror = () => {
        const delay = Math.max(1800, segment.text.length * 55);
        timerRef.current = window.setTimeout(() => {
          if (nextIndex + 1 < dialogue.length) playAt(nextIndex + 1);
          else setStatus('ended');
        }, delay);
      };
      void audio.play().catch(() => {
        setStatus('paused');
      });
      return;
    }

    const delay = Math.max(1800, segment.text.length * 55);
    timerRef.current = window.setTimeout(() => {
      if (nextIndex + 1 < dialogue.length) playAt(nextIndex + 1);
      else setStatus('ended');
    }, delay);
  }, [clearTimer, dialogue, stopAudio]);

  const pause = React.useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    clearTimer();
    setStatus('paused');
  }, [clearTimer]);

  const resume = React.useCallback(() => {
    if (audioRef.current) {
      setStatus('playing');
      void audioRef.current.play().catch(() => setStatus('paused'));
      return;
    }
    playAt(activeIndex);
  }, [activeIndex, playAt]);

  const stop = React.useCallback(() => {
    stopAudio();
    setActiveIndex(0);
    setStatus('idle');
  }, [stopAudio]);

  React.useEffect(() => stopAudio, [stopAudio]);

  return {
    activeIndex,
    status,
    isPlaying: status === 'playing',
    activeSegment: dialogue[activeIndex] ?? null,
    playAt,
    pause,
    resume,
    stop,
  };
}
