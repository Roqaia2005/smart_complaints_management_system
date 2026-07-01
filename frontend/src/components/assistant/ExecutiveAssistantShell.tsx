import React from "react";
import { ExecutiveAssistantLauncher } from "./ExecutiveAssistantLauncher";
import { ExecutiveAssistantPanel } from "./ExecutiveAssistantPanel";
import { useExecutiveAssistant } from "../../hooks/useExecutiveAssistant";

interface ExecutiveAssistantShellProps {
  readonly activeTopic?: string | null;
  readonly riskScore?: number | null;
  readonly recommendation?: string | null;
}

export function ExecutiveAssistantShell({
  activeTopic,
  riskScore,
  recommendation,
}: ExecutiveAssistantShellProps) {
  const assistant = useExecutiveAssistant();

  const hasLoadedBriefing = React.useRef(false);

  React.useEffect(() => {
    // Only load briefing once when the shell mounts
    // Refresh button handles manual reloads
    if (!hasLoadedBriefing.current && assistant.isOpen) {
      hasLoadedBriefing.current = true;
      void assistant.loadBriefing();
    }
  }, [assistant.isOpen, assistant.loadBriefing]);

  // Derive dynamic analytics from the active segment
  const activeSegment = assistant.activeSegmentIndex >= 0 && assistant.activeSegmentIndex < assistant.dialogue.length
    ? assistant.dialogue[assistant.activeSegmentIndex]
    : null;

  const dynamicTopic = activeSegment?.topic || activeTopic;
  const dynamicRiskScore = activeSegment?.risk_score ?? riskScore;
  const dynamicRecommendation = activeSegment?.recommendation || recommendation;

  return (
    <>
      <ExecutiveAssistantLauncher
        isOpen={assistant.isOpen}
        onToggle={() => assistant.setIsOpen((value) => !value)}
        unreadCount={assistant.messages.length > 0 ? 1 : 0}
      />
      <ExecutiveAssistantPanel
        isOpen={assistant.isOpen}
        onClose={() => assistant.setIsOpen(false)}
        summary={assistant.summary}
        messages={assistant.messages}
        suggestedQuestions={assistant.suggestedQuestions}
        inputValue={assistant.inputValue}
        onInputChange={assistant.setInputValue}
        onSubmit={(value) => void assistant.askQuestion(value)}
        isLoading={assistant.isLoading}
        error={assistant.error}
        voiceError={assistant.voiceError}
        isListening={assistant.isListening}
        onToggleVoice={() => assistant.setIsListening((value) => !value)}
        onRefresh={() => void assistant.loadBriefing(true)}
        onReset={assistant.resetAssistant}
        activeTopic={dynamicTopic}
        riskScore={dynamicRiskScore}
        recommendation={dynamicRecommendation}
        activeSegmentIndex={assistant.activeSegmentIndex}
        isPlaying={assistant.audioState.isPlaying}
        isPaused={assistant.audioState.isPaused}
        onStartPlayback={assistant.startPlayback}
        onPausePlayback={assistant.pausePlayback}
        onResumePlayback={assistant.resumePlayback}
        onStopPlayback={assistant.stopPlayback}
      />
    </>
  );
}
