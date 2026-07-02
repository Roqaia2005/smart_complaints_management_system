import React from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Send,
  Bot,
  User as UserIcon,
  Trash2,
  AlertCircle,
  UploadCloud,
  Mic,
  MicOff,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../../types/workflow';
import { useAuthStore } from '../../store/authStore';

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000';

type ChatPhase = 'starting' | 'active' | 'uploading' | 'thinking' | 'submitted' | 'closed' | 'error';

type SessionResponse = {
  session_id: number;
  message: string;
};

type CollectedChatData = {
  category_id?: number;
  category_name?: string;
  problem_summary?: string;
  suggestion_offered?: boolean;
  offensive_count?: number;
  details?: Record<string, string>;
  questions_asked?: number;
};

type ChatBackendResponse = {
  reply: string;
  complaint_ready: boolean;
  complaint_id?: number | null;
  collected_data?: CollectedChatData | null;
};

type BackendErrorResponse = {
  detail?: string | string[];
  message?: string;
};

function toChatServiceUrl(path: string): string {
  const base = CHAT_API_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function toAbsoluteChatUrl(url: string): string {
  if (!url || url.startsWith('http')) return url;
  return toChatServiceUrl(url);
}

// --- Voice input (Web Speech API) -----------------------------------------
// Minimal ambient typings: SpeechRecognition isn't in every TS DOM lib, and we
// want to avoid pulling in a separate @types package for this one API.
type VoiceLang = 'en-US' | 'ar-EG';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const SpeechRecognitionCtor: SpeechRecognitionConstructorLike | null =
  typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null)
    : null;

const isVoiceInputSupported = !!SpeechRecognitionCtor;
// ----------------------------------------------------------------------------

// Memoized so this only re-renders when `messages` actually changes.
// Without this, every keystroke in the input box (setInput) re-renders the
// entire message history (including all framer-motion nodes), which gets
// progressively more expensive as the conversation grows.
const MessageList = React.memo(function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <AnimatePresence initial={false}>
      {messages.map(msg => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn('flex items-start gap-3 max-w-[85%]', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
        >
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm', msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white')}>
            {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
          </div>
          <div className="space-y-2">
            <div className={cn('p-4 rounded-2xl text-sm leading-relaxed shadow-sm', msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none')}>
              {msg.content}
              {msg.attachment && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <UploadCloud size={14} />
                  {msg.attachment.url ? (
                    <a href={toAbsoluteChatUrl(msg.attachment.url)} target="_blank" rel="noreferrer" className="underline hover:text-slate-900 dark:hover:text-white">
                      {msg.attachment.name}
                    </a>
                  ) : (
                    <span>{msg.attachment.name}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
});

export default function StudentChatbot() {
  const { user } = useAuthStore();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = React.useState<string | null>(null);
  const [attachmentName, setAttachmentName] = React.useState('');
  const [attachmentUploading, setAttachmentUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [voiceLang, setVoiceLang] = React.useState<VoiceLang>('en-US');
  const [chatActive, setChatActive] = React.useState(false);
  const [chatPhase, setChatPhase] = React.useState<ChatPhase>('starting');
  const [collectedData, setCollectedData] = React.useState<CollectedChatData | null>(null);
  const [relatedComplaintId, setRelatedComplaintId] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const sessionInitRef = React.useRef(false);
  const sessionPromiseRef = React.useRef<Promise<number> | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  const normalizeUserId = React.useCallback((): number => {
    if (!user?.id) return 1;
    return typeof user.id === 'string' ? parseInt(user.id, 10) || 1 : user.id;
  }, [user]);

  const parseJsonBody = React.useCallback(async (response: Response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const getBackendError = React.useCallback(
    (payload: BackendErrorResponse | null, fallback: string) => {
      if (!payload) return fallback;
      if (typeof payload.detail === 'string') return payload.detail;
      if (Array.isArray(payload.detail)) return payload.detail.join(', ');
      if (typeof payload.message === 'string') return payload.message;
      return fallback;
    },
    []
  );

  const createSession = React.useCallback(
    async (appendInitialMessage = true): Promise<number> => {
      const userId = normalizeUserId();
      const response = await fetch(toChatServiceUrl('/chat/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const payload = await parseJsonBody(response);
      if (!response.ok) {
        const message = getBackendError(payload, `Failed to start session: ${response.statusText}`);
        throw new Error(message);
      }

      const data = payload as SessionResponse;
      setSessionId(data.session_id);

      if (appendInitialMessage) {
        const initialMessage: ChatMessage = {
          id: `session-${data.session_id}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, initialMessage]);
      }

      return data.session_id;
    },
    [normalizeUserId, parseJsonBody, getBackendError]
  );

  const uploadAttachment = React.useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(toChatServiceUrl('/api/upload'), {
      method: 'POST',
      body: formData,
    });

    const payload = await parseJsonBody(response);
    if (!response.ok) {
      const message = getBackendError(payload, `Upload failed: ${response.statusText}`);
      throw new Error(message);
    }

    // upload.py returns a relative path like "/uploads/xxx.png" — resolve it
    // against the chat API host, not the frontend's own origin.
    return toAbsoluteChatUrl(payload?.url || '');
  }, [parseJsonBody, getBackendError]);

  const createSessionOnce = React.useCallback(
    async (appendInitialMessage = true): Promise<number> => {
      if (sessionPromiseRef.current) {
        return sessionPromiseRef.current;
      }

      const promise = createSession(appendInitialMessage);
      sessionPromiseRef.current = promise;
      promise.finally(() => {
        if (sessionPromiseRef.current === promise) {
          sessionPromiseRef.current = null;
        }
      });

      return promise;
    },
    [createSession]
  );

  const sendMessageRequest = React.useCallback(
    async (
      message: string,
      attachment_url: string | null,
      currentSessionId: number,
      retryOnClosed = true
    ): Promise<ChatBackendResponse> => {
      const userId = normalizeUserId();
      const body = {
        session_id: currentSessionId,
        user_id: userId,
        message,
        attachment_url,
      };

      const response = await fetch(toChatServiceUrl('/chat/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 404 && retryOnClosed) {
        const newSessionId = await createSession(false);
        setSessionId(newSessionId);
        return sendMessageRequest(message, attachment_url, newSessionId, false);
      }

      const payload = await parseJsonBody(response);
      if (response.ok) {
        return payload as ChatBackendResponse;
      }

      if (response.status === 422) {
        throw new Error('Message too long. Please shorten your message and try again.');
      }

      const messageText = getBackendError(payload, `Server error: ${response.statusText}`);
      throw new Error(messageText);
    },
    [normalizeUserId, createSession, parseJsonBody, getBackendError]
  );

  React.useEffect(() => {
    if (sessionInitRef.current || !user?.id) {
      return;
    }

    sessionInitRef.current = true;
    setError(null);
    setIsLoading(true);

    createSessionOnce(true)
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to start chat session.';
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [createSessionOnce, user?.id]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Once the user has sent at least one message, tint the page background blue
  // (light mode only — see .chat-active in index.css). Cleaned up on unmount.
  React.useEffect(() => {
    if (!chatActive) return;
    document.documentElement.classList.add('chat-active');
    return () => {
      document.documentElement.classList.remove('chat-active');
    };
  }, [chatActive]);

  // Stop any in-progress recognition session when the component unmounts.
  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleAttachmentChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setAttachmentUploading(true);
    setAttachmentName(file.name);

    try {
      const url = await uploadAttachment(file);
      setAttachmentUrl(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed.';
      setUploadError(message);
      setAttachmentUrl(null);
      setAttachmentName('');
    } finally {
      setAttachmentUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadAttachment]);

  const handleRemoveAttachment = React.useCallback(() => {
    setAttachmentUrl(null);
    setAttachmentName('');
    setUploadError(null);
  }, []);

  const getRecognition = React.useCallback((): SpeechRecognitionLike | null => {
    if (!SpeechRecognitionCtor) return null;
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    }
    return recognitionRef.current;
  }, []);

  const stopListening = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = React.useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) {
      setVoiceError("Voice input isn't supported in this browser. Please type your message instead.");
      return;
    }

    setVoiceError(null);
    recognition.lang = voiceLang;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        setInput(prev => (prev.trim() ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('Microphone access was denied. Please allow microphone permissions in your browser settings.');
      } else if (event.error === 'no-speech') {
        setVoiceError("Didn't catch that — no speech detected. Try again.");
      } else if (event.error === 'network') {
        setVoiceError('Network error during voice recognition. Please try again.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone was found. Please connect a microphone and try again.');
      } else {
        setVoiceError('Voice input failed. Please try again or type your message.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setVoiceError('Could not start voice input. Please try again.');
    }
  }, [getRecognition, voiceLang]);

  const handleToggleMic = React.useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleSend = React.useCallback(async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || attachmentUploading) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      attachment: attachmentUrl ? { name: attachmentName, url: attachmentUrl } : undefined,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setChatActive(true);
    setInput('');
    setIsLoading(true);

    try {
      const activeSessionId = sessionId ?? (await createSessionOnce(false));
      const apiResponse = await sendMessageRequest(trimmed, attachmentUrl, activeSessionId);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: apiResponse.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (apiResponse.complaint_ready) {
        const successContent = apiResponse.complaint_id
          ? `✅ Complaint submitted successfully. Complaint ID: #${apiResponse.complaint_id}`
          : '✅ Complaint submitted successfully.';

        setMessages(prev => [
          ...prev,
          {
            id: `success-${Date.now()}`,
            role: 'assistant',
            content: successContent,
            timestamp: new Date().toISOString(),
          },
        ]);
        setSessionId(null);
      }

      // Check if session has been closed by guardrails, limit, or similar
      const isClosed = apiResponse.reply.includes("closed") || 
                       apiResponse.reply.includes("إغلاق") || 
                       apiResponse.reply.includes("limit") || 
                       apiResponse.reply.includes("الحد الأقصى") ||
                       apiResponse.reply.includes("reopened");
      if (isClosed) {
        setSessionId(null);
      }

      if (attachmentUrl) {
        setAttachmentUrl(null);
        setAttachmentName('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message.';
      setError(message);
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, attachmentUploading, attachmentUrl, attachmentName, sessionId, createSessionOnce, sendMessageRequest]);

  const handleClearChat = React.useCallback(() => {
    setMessages(prev => (prev.length > 1 ? [prev[0]] : prev));
    setError(null);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto border bg-card rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
      <div className="p-4 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">UniResolve AI</h2>
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', !sessionId ? 'bg-red-500' : 'bg-emerald-500 animate-pulse')} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {!sessionId ? 'Initializing...' : 'Active Assistant'}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400" onClick={handleClearChat} disabled={isLoading}>
          <Trash2 size={18} />
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">Check your connection and try again.</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-none">
        <MessageList messages={messages} />

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
        {(attachmentName || uploadError) && (
          <div className="mb-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UploadCloud size={14} />
              <span>{attachmentUploading ? `Uploading ${attachmentName}...` : attachmentName}</span>
            </div>
            {attachmentName && !attachmentUploading && (
              <button type="button" onClick={handleRemoveAttachment} className="rounded-full p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {uploadError && <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{uploadError}</p>}
        {voiceError && <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{voiceError}</p>}

        {isVoiceInputSupported && (
          <div className="flex items-center justify-end gap-2 max-w-3xl mx-auto mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voice language</span>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80 p-0.5">
              <button
                type="button"
                onClick={() => setVoiceLang('en-US')}
                disabled={isListening}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors',
                  voiceLang === 'en-US' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setVoiceLang('ar-EG')}
                disabled={isListening}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors',
                  voiceLang === 'ar-EG' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                )}
              >
                AR
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="relative flex items-center gap-2 max-w-3xl mx-auto">
          <label htmlFor="attachment-input" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer">
            <UploadCloud size={18} />
          </label>
          <input
            id="attachment-input"
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentChange}
            disabled={isLoading || attachmentUploading}
          />
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="h-12 w-full pl-12 pr-24 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-blue-500 shadow-sm"
            disabled={isLoading || attachmentUploading}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleToggleMic}
            className={cn(
              'absolute right-11 h-9 w-9 rounded-lg',
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 animate-pulse'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            )}
            disabled={isLoading || attachmentUploading || !isVoiceInputSupported}
            title={
              !isVoiceInputSupported
                ? "Voice input isn't supported in this browser"
                : isListening
                ? 'Stop recording'
                : 'Start voice input'
            }
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </Button>
          <Button
            type="submit"
            size="icon"
            className="absolute right-1.5 h-9 w-9 rounded-lg shadow-lg shadow-blue-500/20"
            disabled={!input.trim() || isLoading || attachmentUploading}
          >
            <Send size={18} />
          </Button>
        </form>
        <p className="text-[10px] text-center text-slate-500 mt-3 font-medium">
          UniResolve AI may provide helpful information. Please review all details before submitting.
        </p>
      </div>
    </div>
  );
}