/**
 * ExecutiveBriefingPanel.tsx
 *
 * Simple, professional executive briefing component that displays
 * structured analytics from the DSS system. No complex dialogue,
 * no conversation bubbles, just clean briefing sections.
 */

import React, { useState, useEffect, useRef } from "react";
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
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  // One persistent <audio> element per generated briefing. Re-using this
  // (instead of `new Audio()` on every Play click) is what prevents two
  // overlapping voices and avoids re-hitting the backend/TTS on every
  // play/pause/resume cycle.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
  };

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      cleanupAudio();
      setState("idle");
      setBriefing(null);
      setCurrentSectionIndex(0);
      setError(null);
    }
    // Stop playback if the panel is closed while audio is still going.
    if (!isOpen) {
      cleanupAudio();
    }
  }, [isOpen]);

  // Make sure audio is stopped if the component unmounts entirely.
  useEffect(() => cleanupAudio, []);

  // Load briefing when panel opens
  useEffect(() => {
    if (isOpen && state === "idle") {
      loadBriefing();
    }
  }, [isOpen, state]);

  const loadBriefing = async () => {
    try {
      cleanupAudio();
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

  const attachAudioHandlers = (audio: HTMLAudioElement, sectionCount: number) => {
    audio.ontimeupdate = () => {
      // Drive section progress from the audio's real playback position
      // instead of a separate setInterval simulation, so it can never
      // drift out of sync with pause/resume.
      if (!audio.duration || !isFinite(audio.duration) || sectionCount === 0) return;
      const pct = audio.currentTime / audio.duration;
      const idx = Math.min(sectionCount - 1, Math.floor(pct * sectionCount));
      setCurrentSectionIndex(idx);
    };
    audio.onended = () => {
      setState("ready");
      setCurrentSectionIndex(0);
    };
    audio.onerror = () => {
      setError("Audio playback failed");
      setState("error");
    };
  };

  const handlePlayAudio = async () => {
    if (!briefing) return;

    // Resume: audio already generated and just paused -- play in place,
    // do NOT regenerate or create a second Audio element.
    if (audioRef.current && state === "paused") {
      setError(null);
      setState("playing");
      audioRef.current.play().catch(() => {
        setError("Audio playback failed");
        setState("error");
      });
      return;
    }

    // Guard against double-clicks firing a second generation request
    // while the first is still in flight.
    if (audioLoading) return;

    try {
      setAudioLoading(true);
      setError(null);

      const audioResponse: BriefingAudioResponse =
        await recommendationService.generateBriefingAudio({
          voice: "en-US-JennyNeural",
          speed: 1.0,
        });

      if (audioResponse.audio_url) {
        cleanupAudio(); // just in case anything was left over
        const fullAudioUrl = `${RECOMMENDATION_API_URL}${audioResponse.audio_url}`;
        const audio = new Audio(fullAudioUrl);
        audioRef.current = audio;
        attachAudioHandlers(audio, briefing.sections.length);

        setState("playing");
        await audio.play();
      } else {
        // No audio available, just show text
        setState("ready");
      }
    } catch (err) {
      console.error("Failed to generate audio:", err);
      setError("Failed to generate audio. Text briefing is available.");
      setState("ready");
    } finally {
      setAudioLoading(false);
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setState("paused");
  };

  const handleReplay = () => {
    if (audioRef.current) {
      // Audio already generated -- just rewind and play, no regeneration.
      audioRef.current.currentTime = 0;
      setCurrentSectionIndex(0);
      setError(null);
      setState("playing");
      audioRef.current.play().catch(() => {
        setError("Audio playback failed");
        setState("error");
      });
    } else {
      handlePlayAudio();
    }
  };

  const handleSkipToSection = (index: number) => {
    setCurrentSectionIndex(index);
    if (audioRef.current && audioRef.current.duration && briefing) {
      audioRef.current.currentTime =
        (index / briefing.sections.length) * audioRef.current.duration;
    }
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
                  disabled={!briefing || audioLoading}
                  size="sm"
                  className="gap-2"
                >
                  <span className="text-base">▶</span>
                  {audioLoading ? "Generating…" : state === "paused" ? "Resume" : "Play Briefing"}
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