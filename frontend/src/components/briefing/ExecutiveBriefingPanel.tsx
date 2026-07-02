/**
 * ExecutiveBriefingPanel.tsx
 *
 * Simple, professional executive briefing component that displays
 * structured analytics from the DSS system. No complex dialogue,
 * no conversation bubbles, just clean briefing sections.
 */

import React, { useState, useEffect } from "react";
import { recommendationService , RECOMMENDATION_API_URL} from "@/api/recommendationService";
import type {
  BriefingSection,
  BriefingResponse,
  BriefingAudioResponse,
} from "@/api/recommendationService";
import { Button } from "@/components/ui/button";
import "./ExecutiveBriefingPanel.css";

interface ExecutiveBriefingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type BriefingState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error";

export const ExecutiveBriefingPanel: React.FC<ExecutiveBriefingPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [state, setState] = useState<BriefingState>("idle");
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setState("idle");
      setBriefing(null);
      setAudioUrl(null);
      setCurrentSectionIndex(0);
      setError(null);
    }
  }, [isOpen]);

  // Load briefing when panel opens
  useEffect(() => {
    if (isOpen && state === "idle") {
      loadBriefing();
    }
  }, [isOpen, state]);

  const loadBriefing = async () => {
    try {
      setState("loading");
      setError(null);

      const response = await recommendationService.generateBriefing();
      setBriefing(response);
      setState("ready");
    } catch (err) {
      console.error("Failed to load briefing:", err);
      setError("Failed to load briefing. Please try again.");
      setState("error");
    }
  };

  const handlePlayAudio = async () => {
    if (!briefing) return;

    try {
      setState("playing");
      setError(null);

      const audioResponse: BriefingAudioResponse =
        await recommendationService.generateBriefingAudio({
          voice: "en-US-JennyNeural",
          speed: 1.0,
        });

      if (audioResponse.audio_url) {
        // Construct full URL to backend audio endpoint
        const fullAudioUrl = `${RECOMMENDATION_API_URL}${audioResponse.audio_url}`;
        setAudioUrl(fullAudioUrl);

        // Create and play audio
        const audio = new Audio(fullAudioUrl);
        audio.play();

        // Simulate section progression based on duration
        if (audioResponse.duration_estimate && briefing.sections.length > 0) {
          const sectionDuration =
            audioResponse.duration_estimate / briefing.sections.length;
          const interval = setInterval(() => {
            setCurrentSectionIndex((prev) => {
              if (prev < briefing.sections.length - 1) {
                return prev + 1;
              } else {
                clearInterval(interval);
                return prev;
              }
            });
          }, sectionDuration * 1000);

          audio.onended = () => {
            clearInterval(interval);
            setState("ready");
            setCurrentSectionIndex(0);
          };

          audio.onerror = () => {
            clearInterval(interval);
            setError("Audio playback failed");
            setState("error");
          };
        }
      } else {
        // No audio available, just show text
        setState("ready");
      }
    } catch (err) {
      console.error("Failed to generate audio:", err);
      setError("Failed to generate audio. Text briefing is available.");
      setState("ready");
    }
  };

  const handlePause = () => {
    // In a real implementation, you would pause the audio element
    setState("paused");
  };

  const handleReplay = () => {
    setCurrentSectionIndex(0);
    handlePlayAudio();
  };

  const handleSkipToSection = (index: number) => {
    setCurrentSectionIndex(index);
    // In a real implementation, you would seek to that section in the audio
  };

  if (!isOpen) return null;

  return (
    <div className="briefing-overlay">
      <div className="briefing-panel">
        {/* Header */}
        <div className="briefing-header">
          <div className="briefing-title">
            <h2>Executive AI Briefing</h2>
            <span className="briefing-badge">DSS Analytics</span>
          </div>
          <button className="briefing-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div className="briefing-status">
          <div className="status-indicator">
            <span className={`status-dot ${state}`}></span>
            <span className="status-text">
              {state === "idle" && "Ready"}
              {state === "loading" && "Loading briefing..."}
              {state === "ready" && "Ready to play"}
              {state === "playing" && "Playing..."}
              {state === "paused" && "Paused"}
              {state === "error" && "Error"}
            </span>
          </div>
          {state === "playing" && briefing && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${((currentSectionIndex + 1) / briefing.sections.length) * 100}%`,
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="briefing-error">
            <span>{error}</span>
          </div>
        )}

        {/* Briefing Content */}
        <div className="briefing-content">
          {state === "loading" && (
            <div className="briefing-loading">
              <div className="loading-spinner"></div>
              <p>Loading executive briefing...</p>
            </div>
          )}

          {state === "error" && !briefing && (
            <div className="briefing-error-state">
              <p>Unable to load briefing</p>
              <button onClick={loadBriefing} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {briefing && (
            <div className="briefing-sections">
              {briefing.sections.map((section, index) => (
                <div
                  key={section.section}
                  className={`briefing-section ${
                    index === currentSectionIndex ? "active" : ""
                  } ${index < currentSectionIndex ? "completed" : ""}`}
                  onClick={() => handleSkipToSection(index)}
                >
                  <div className="section-indicator">
                    {index < currentSectionIndex ? "✓" : index + 1}
                  </div>
                  <div className="section-content">
                    <h4 className="section-title">
                      {section.section.replace(/_/g, " ").toUpperCase()}
                    </h4>
                    <p className="section-text">{section.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        {briefing && state !== "loading" && state !== "idle" && (
          <div className="briefing-controls">
            <div className="controls-row">
              {state === "ready" || state === "paused" ? (
                <Button
                  onClick={handlePlayAudio}
                  disabled={!briefing}
                  size="sm"
                  className="gap-2"
                >
                  <span className="text-base">▶</span>
                  Play Briefing
                </Button>
              ) : state === "playing" ? (
                <Button
                  onClick={handlePause}
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                >
                  <span className="text-base">⏸</span>
                  Pause
                </Button>
              ) : null}

              <Button
                onClick={handleReplay}
                disabled={!briefing}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <span className="text-base">↻</span>
                Replay
              </Button>

              <Button
                onClick={loadBriefing}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <span className="text-base">↻</span>
                Refresh
              </Button>
            </div>

            {/* Section Navigation */}
            {briefing && briefing.sections.length > 0 && (
              <div className="section-navigation">
                <span className="nav-label">Jump to section:</span>
                <div className="nav-buttons">
                  {briefing.sections.map((section, index) => (
                    <Button
                      key={section.section}
                      size="icon"
                      variant={
                        index === currentSectionIndex ? "default" : "outline"
                      }
                      onClick={() => handleSkipToSection(index)}
                      title={section.section.replace(/_/g, " ")}
                      className="h-8 w-8 text-xs font-bold"
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="briefing-footer">
          <p>
            Briefing generated from DSS analytics •{" "}
            {briefing?.sections.length || 0} sections
          </p>
        </div>
      </div>
    </div>
  );
};
