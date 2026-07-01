import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  Brain,
  ShieldAlert,
  TrendingUp,
  CirclePause,
  Play,
  RefreshCcw,
  AlertCircle,
  Loader2,
  MessageSquareText,
  AudioLines,
  Radio,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import type { ExecutiveMessage } from "../../hooks/useExecutiveAssistant";

interface ExecutiveAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  messages: ExecutiveMessage[];
  suggestedQuestions: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isLoading: boolean;
  error: string | null;
  voiceError: string | null;
  isListening: boolean;
  onToggleVoice: () => void;
  onRefresh: () => void;
  onReset: () => void;
  activeTopic?: string | null;
  riskScore?: number | null;
  recommendation?: string | null;
  activeSegmentIndex?: number;
  isPlaying?: boolean;
  isPaused?: boolean;
  onStartPlayback?: () => void;
  onPausePlayback?: () => void;
  onResumePlayback?: () => void;
  onStopPlayback?: () => void;
}

const emptyStateQuestions = [
  "What is the top risk this week?",
  "Summarize the department trends",
  "What should I prioritize today?",
];

export function ExecutiveAssistantPanel({
  isOpen,
  onClose,
  summary,
  messages,
  suggestedQuestions,
  inputValue,
  onInputChange,
  onSubmit,
  isLoading,
  error,
  voiceError,
  isListening,
  onToggleVoice,
  onRefresh,
  onReset,
  activeTopic,
  riskScore,
  recommendation,
  activeSegmentIndex = -1,
  isPlaying = false,
  isPaused = false,
  onStartPlayback,
  onPausePlayback,
  onResumePlayback,
  onStopPlayback,
}: ExecutiveAssistantPanelProps) {
  const lastSpokenMessageId = React.useRef<string | null>(null);
  const [shouldAutoSpeak, setShouldAutoSpeak] = React.useState(false);

  const stopSpeech = React.useCallback(() => {
    onStopPlayback?.();
  }, [onStopPlayback]);

  const requestPlayback = React.useCallback(() => {
    setShouldAutoSpeak(true);
  }, []);

  const speakText = React.useCallback(
    (text: string, audioUrl?: string | null) => {
      if (!text.trim()) return;
      // Audio playback is now handled by the queue system
      // This is kept for backward compatibility with text-only fallback
    },
    [],
  );

  const pauseSpeech = React.useCallback(() => {
    onPausePlayback?.();
  }, [onPausePlayback]);

  const resumeSpeech = React.useCallback(() => {
    onResumePlayback?.();
  }, [onResumePlayback]);

  React.useEffect(() => {
    if (!isOpen) {
      onStopPlayback?.();
      lastSpokenMessageId.current = null;
      setShouldAutoSpeak(false);
      return;
    }

    if (!shouldAutoSpeak) return;

    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.speaker === "assistant");
    if (!latestAssistantMessage) return;
    if (lastSpokenMessageId.current === latestAssistantMessage.id) {
      setShouldAutoSpeak(false);
      return;
    }

    lastSpokenMessageId.current = latestAssistantMessage.id;
    setShouldAutoSpeak(false);
    // Audio playback is handled by the queue system
  }, [isOpen, messages, shouldAutoSpeak, onStopPlayback]);

  React.useEffect(() => {
    if (isOpen && onStartPlayback && messages.length > 0) {
      // Auto-start playback when panel opens with messages
      const timer = setTimeout(() => {
        onStartPlayback();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length, onStartPlayback]);

  React.useEffect(() => () => stopSpeech(), [stopSpeech]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim()) return;
    requestPlayback();
    onSubmit(inputValue);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-x-2 bottom-2 z-50 mx-auto w-[calc(100%-1rem)] max-w-6xl sm:inset-x-4 sm:bottom-4"
        >
          <Card className="flex max-h-[92dvh] min-h-0 flex-col overflow-hidden border border-white/50 bg-white/75 shadow-[0_24px_90px_rgba(15,23,42,0.20)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/80">
            <div className="shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Executive AI Analyst
                    </p>
                    <h2 className="text-xl font-semibold">
                      Live briefing cockpit
                    </h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onReset}>
                    Reset
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-4">
                  <Card className="border-0 bg-background/70 shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            Executive briefing
                          </CardTitle>
                          <CardDescription>
                            {summary ||
                              "Preparing a concise analysis of the current operational outlook."}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="gap-2">
                          <Sparkles className="h-3.5 w-3.5" />
                          Live
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            <ShieldAlert className="h-3.5 w-3.5" /> Risk
                          </div>
                          <div className="text-2xl font-semibold">
                            {riskScore ?? "—"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            <TrendingUp className="h-3.5 w-3.5" /> Topic
                          </div>
                          <div className="line-clamp-2 text-sm font-medium">
                            {activeTopic || "Operational review"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            <AudioLines className="h-3.5 w-3.5" /> Audio
                          </div>
                          <div className="text-sm font-medium">
                            Waveform ready
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                          <MessageSquareText className="h-4 w-4" /> Current
                          recommendation
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {recommendation ||
                            "The analyst is preparing the next priority action."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="flex min-h-0 flex-col border-0 bg-background/70 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Conversation</CardTitle>
                      <CardDescription>
                        Context-aware follow-ups with live transcript support.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col space-y-3">
                      <div className="min-h-[220px] flex-1 space-y-3 overflow-auto rounded-2xl border border-border/60 bg-card/60 p-3">
                        {messages.length === 0 && !isLoading ? (
                          <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                            Your executive briefing will appear here as soon as
                            the assistant finishes preparing it.
                          </div>
                        ) : null}

                        {messages.map((message, index) => {
                          const isActiveSegment = message.id === `segment-${activeSegmentIndex}`;
                          const speakerLabel = message.speaker === "user" ? "You" : 
                                               message.id.startsWith("segment-") && index % 2 === 0 ? "Host" : 
                                               message.id.startsWith("segment-") ? "Analyst" : "Analyst";

                          return (
                            <div
                              key={message.id}
                              className={cn(
                                "flex gap-3 transition-all",
                                message.speaker === "user"
                                  ? "justify-end"
                                  : "justify-start",
                                isActiveSegment && "scale-[1.02]",
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                  message.speaker === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : isActiveSegment
                                      ? "border-2 border-primary/50 bg-background/90"
                                      : "border border-border/70 bg-background/90",
                                )}
                              >
                                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                                  {speakerLabel}
                                  {isActiveSegment && isPlaying && (
                                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                                  )}
                                </div>
                                <div>{message.text}</div>
                              </div>
                            </div>
                          );
                        })}

                        {isLoading ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparing the next insight…
                          </div>
                        ) : null}
                      </div>

                      {error ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" /> {error}
                        </div>
                      ) : null}

                      {voiceError ? (
                        <div className="text-sm text-destructive">
                          {voiceError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {(suggestedQuestions.length
                          ? suggestedQuestions
                          : emptyStateQuestions
                        ).map((question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => onSubmit(question)}
                            className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="flex min-h-0 flex-col border-0 bg-background/70 shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        Voice experience
                      </CardTitle>
                      <CardDescription>
                        Fluid, premium interaction with interruption and resume
                        support.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <Radio className="h-4 w-4" /> Live transcript
                          </div>
                          <Badge
                            variant={
                              isListening
                                ? "destructive"
                                : isPlaying
                                  ? "default"
                                  : isPaused
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {isListening
                              ? "Listening"
                              : isPlaying
                                ? "Playing"
                                : isPaused
                                  ? "Paused"
                                  : "Ready"}
                          </Badge>
                        </div>
                        <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/70">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                              <AudioLines className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">
                                {isPlaying ? "Now playing" : isPaused ? "Paused" : "Ready to play"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {activeSegmentIndex >= 0 
                                  ? `Segment ${activeSegmentIndex + 1} of ${messages.filter(m => m.id.startsWith("segment-")).length}`
                                  : "Press play to start briefing"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={onToggleVoice}
                          className="gap-2"
                        >
                          {isListening ? (
                            <MicOff className="h-4 w-4" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                          {isListening ? "Stop listening" : "Voice input"}
                        </Button>
                        {!isPlaying && !isPaused ? (
                          <Button
                            type="button"
                            variant="default"
                            className="gap-2"
                            onClick={onStartPlayback}
                            disabled={messages.filter(m => m.id.startsWith("segment-")).length === 0}
                          >
                            <Play className="h-4 w-4" /> Play briefing
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2"
                              onClick={onPausePlayback}
                              disabled={!isPlaying}
                            >
                              <CirclePause className="h-4 w-4" /> Pause
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2"
                              onClick={onResumePlayback}
                              disabled={!isPaused}
                            >
                              <Play className="h-4 w-4" /> Resume
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2"
                              onClick={onStopPlayback}
                            >
                              <CirclePause className="h-4 w-4" /> Stop
                            </Button>
                          </>
                        )}
                      </div>

                      <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <Input
                          value={inputValue}
                          onChange={(event) =>
                            onInputChange(event.target.value)
                          }
                          placeholder="Ask a follow-up question"
                          className="h-10 flex-1"
                        />
                        <Button
                          type="submit"
                          className="gap-2 sm:w-auto"
                          disabled={isLoading || !inputValue.trim()}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
