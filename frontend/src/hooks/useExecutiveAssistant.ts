/**
 * Target path: src/hooks/useExecutiveAssistant.ts (REPLACES existing file)
 *
 * CHANGE IN THIS VERSION
 * ------------------------
 * The main fix for the briefing-regeneration loop lives in
 * useAudioQueue.ts (setQueue wasn't memoized). No change was needed here
 * for that bug -- loadBriefing's own useCallback was already correct,
 * it just depended on an unstable function from the other hook.
 *
 * Separate, smaller bug fixed here: in askQuestion(), after playing the
 * answer audio, the onended handler resumed the briefing using the
 * `resumeIndex` *state variable* closed over at the time askQuestion was
 * created -- not `response.resume_index`, which is what was just
 * received from the server and written into state via setResumeIndex().
 * Since React state updates aren't synchronous, `resumeIndex` inside the
 * closure was always one step behind. In practice this meant: ask a
 * question, get an answer, and the briefing could resume from the wrong
 * segment. Fixed by capturing the server's resume_index into a local
 * const and using that in the closure instead of the stale state value.
 */
import React from 'react';
import assistantService, { type DialogueSegment } from '../api/assistantService';
import { useAudioQueue } from './useAudioQueue';

export interface ExecutiveMessage {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
  topic?: string | null;
  risk_score?: number | null;
  recommendation?: string | null;
  audio_url?: string | null;
}

export function useExecutiveAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState('');
  const [dialogue, setDialogue] = React.useState<DialogueSegment[]>([]);
  const [messages, setMessages] = React.useState<ExecutiveMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = React.useState<string[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [resumeIndex, setResumeIndex] = React.useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = React.useState<number>(-1);

  const {
    state: audioState,
    playFromIndex,
    pause,
    resume,
    stop,
    setQueue,
  } = useAudioQueue();

  const loadBriefing = React.useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    stop();

    try {
      const data = await assistantService.generateBriefing(forceRefresh);
      setSessionId(data.session_id);
      setSummary(data.summary);
      setDialogue(data.dialogue);
      setSuggestedQuestions(data.suggested_questions ?? []);
      setResumeIndex(0);
      setActiveSegmentIndex(-1);

      const initialMessages: ExecutiveMessage[] = data.dialogue.map((segment, index) => ({
        id: `segment-${index}`,
        speaker: 'assistant',
        text: segment.text,
        topic: segment.topic,
        risk_score: segment.risk_score,
        recommendation: segment.recommendation,
        audio_url: segment.audio_url,
      }));

      setMessages(initialMessages);
      setQueue(data.dialogue);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'The assistant briefing is temporarily unavailable.';
      setError(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [stop, setQueue]);

  const askQuestion = React.useCallback(async (question: string) => {
    if (!question.trim() || !sessionId) return;

    const trimmedQuestion = question.trim();
    setInputValue('');
    
    // FIX: Fully stop briefing audio instead of just pausing to prevent overlap
    stop();
    setActiveSegmentIndex(-1);

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        speaker: 'user',
        text: trimmedQuestion,
      },
    ]);

    setIsLoading(true);
    setError(null);

    try {
      const response = await assistantService.ask(sessionId, trimmedQuestion, Math.max(0, resumeIndex));

      // FIX: capture the server's resume_index locally and use THIS in the
      // onended closure below, not the `resumeIndex` state variable (which
      // would still hold the pre-update value due to React's async state
      // updates -- a stale closure bug that could resume the briefing from
      // the wrong segment after an interruption).
      const nextResumeIndex = response.resume_index ?? Math.max(0, resumeIndex);
      setResumeIndex(nextResumeIndex);

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          speaker: 'assistant',
          text: response.answer,
          recommendation: response.answer,
          audio_url: response.audio_url,
        },
      ]);
      setSuggestedQuestions(response.suggested_questions ?? []);

      // Play the answer audio using the audio queue system to avoid overlap
      if (response.audio_url) {
        // Create a temporary segment for the answer audio
        const answerSegment: DialogueSegment = {
          index: -1,
          speaker: 'analyst',
          text: response.answer,
          audio_url: response.audio_url,
          topic: '',
          risk_score: null,
          recommendation: null,
        };
        
        // FIX: Use a ref to track the latest dialogue to avoid stale closure
        const dialogueRef = React.useRef(dialogue);
        dialogueRef.current = dialogue;
        
        // Play the answer audio directly, then resume briefing
        const answerAudio = new Audio(response.audio_url);
        answerAudio.onended = () => {
          // Resume briefing from saved index after answer
          const currentDialogue = dialogueRef.current;
          if (nextResumeIndex >= 0 && nextResumeIndex < currentDialogue.length) {
            setActiveSegmentIndex(nextResumeIndex);
            playFromIndex(nextResumeIndex, currentDialogue);
          }
        };
        void answerAudio.play();
      } else {
        // No audio, just resume briefing after a short delay
        setTimeout(() => {
          if (nextResumeIndex >= 0 && nextResumeIndex < dialogue.length) {
            setActiveSegmentIndex(nextResumeIndex);
            playFromIndex(nextResumeIndex, dialogue);
          }
        }, 500);
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'The follow-up request could not be completed.';
      setError(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [resumeIndex, sessionId, pause, playFromIndex, dialogue]);

  const resetAssistant = React.useCallback(() => {
    stop();
    setSessionId(null);
    setSummary('');
    setDialogue([]);
    setMessages([]);
    setSuggestedQuestions([]);
    setError(null);
    setInputValue('');
    setResumeIndex(0);
    setActiveSegmentIndex(-1);
  }, [stop]);

  const startPlayback = React.useCallback(() => {
    if (dialogue.length === 0) return;
    setActiveSegmentIndex(0);
    playFromIndex(0, dialogue);
  }, [dialogue, playFromIndex]);

  const pausePlayback = React.useCallback(() => {
    pause();
  }, [pause]);

  const resumePlayback = React.useCallback(() => {
    if (audioState.currentIndex < dialogue.length) {
      setActiveSegmentIndex(audioState.currentIndex);
      resume();
    }
  }, [audioState.currentIndex, dialogue.length, resume]);

  const stopPlayback = React.useCallback(() => {
    stop();
    setActiveSegmentIndex(-1);
  }, [stop]);

  // Update active segment index when audio state changes
  React.useEffect(() => {
    if (audioState.isPlaying && audioState.currentIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(audioState.currentIndex);
    }
  }, [audioState.isPlaying, audioState.currentIndex, activeSegmentIndex]);

  return {
    isOpen,
    setIsOpen,
    isLoading,
    error,
    sessionId,
    summary,
    dialogue,
    messages,
    suggestedQuestions,
    inputValue,
    setInputValue,
    voiceError,
    setVoiceError,
    isListening,
    setIsListening,
    resumeIndex,
    activeSegmentIndex,
    audioState,
    loadBriefing,
    askQuestion,
    resetAssistant,
    startPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
  };
}