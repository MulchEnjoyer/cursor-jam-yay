"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { VoiceNoteStatus } from "@/generated/prisma/enums";
import { VoiceNoteStatus as VoiceNoteStatusEnum } from "@/generated/prisma/enums";

type InsightsShape = {
  quote?: string | null;
  topics?: string[] | null;
  keyTakeaways?: string[] | null;
  actionItems?: string[] | null;
  error?: string | null;
};

export type NoteDetail = {
  id: string;
  audioUrl: string;
  transcriptText: string | null;
  status: VoiceNoteStatus;
  insights: InsightsShape | null;
  waveformPeaks: number[];
  durationSeconds: number | null;
  createdAt: string | Date;
};

function statusText(status: NoteDetail["status"]): string {
  switch (status) {
    case VoiceNoteStatusEnum.READY:
      return "Transcription ready";
    case VoiceNoteStatusEnum.FAILED:
      return "Transcription failed";
    case VoiceNoteStatusEnum.IN_PROGRESS:
    case VoiceNoteStatusEnum.PENDING:
      return "Transcribing…";
    default:
      return "Unknown status";
  }
}

function SkeletonBar(props: { className?: string }) {
  return <div className={["h-4 rounded-md bg-white/5", props.className ?? ""].join(" ")} />;
}

function WaveformPlayer(props: { audioUrl: string; peaks: number[] }) {
  const { audioUrl, peaks } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const cappedPeaks = useMemo(() => peaks.slice(0, 180), [peaks]);
  const canPlay = Boolean(audioUrl && audioUrl.trim().length > 0 && cappedPeaks.length > 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const timeout = window.setTimeout(() => {
      setProgress(0);
      setPlaying(false);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const d = audio.duration || 0;
      setDuration(d);
      const p = d ? audio.currentTime / d : 0;
      setProgress(p);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const onScrub = (e: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    audio.currentTime = pct * duration;
  };

  if (!canPlay) {
    return (
      <div className="rounded-2xl border border-border/60 bg-white/5 p-4">
        <p className="text-sm font-medium">Playback unavailable</p>
        <p className="mt-1 text-xs text-muted">This is a preview tile (no audio).</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Playback</p>
          <p className="mt-1 text-xs text-muted">
            {duration ? `${Math.round(duration * progress)}/${Math.round(duration)}s` : "\u00A0"}
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="rounded-full border border-border/60 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <div className="mt-4">
        <div
          role="button"
          tabIndex={0}
          onClick={onScrub}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggle();
          }}
          className="relative flex h-16 cursor-pointer items-end gap-[1px] overflow-hidden rounded-xl border border-border/50 bg-black/10 p-3"
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-accent/20"
            style={{ width: `${progress * 100}%` }}
          />

          {cappedPeaks.map((p, i) => (
            <div
              key={i}
              className="relative z-[1] w-[2px] rounded-sm bg-white/25"
              style={{ height: `${Math.max(3, Math.round(p * 46))}px` }}
            />
          ))}

          <audio ref={audioRef} src={audioUrl} preload="metadata" />
        </div>
      </div>
    </div>
  );
}

export function SplitView(props: {
  note: NoteDetail | null;
  onBack: () => void;
}) {
  const { note, onBack } = props;

  const insights = note?.insights ?? null;
  const safeTopics = insights?.topics?.filter((t): t is string => typeof t === "string") ?? [];
  const safeQuote = typeof insights?.quote === "string" ? insights.quote : null;
  const safeKeyTakeaways = insights?.keyTakeaways?.filter(
    (t): t is string => typeof t === "string",
  ) ?? [];
  const safeActionItems = insights?.actionItems?.filter(
    (t): t is string => typeof t === "string",
  ) ?? [];

  const isReady = note?.status === VoiceNoteStatusEnum.READY;

  if (!note) {
    return (
      <div className="glass p-6">
        <h2 className="text-lg font-semibold">Select a note</h2>
        <p className="mt-2 text-muted">Choose a card from the Note Wall to open the split view.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="glass p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                Note {note.id.slice(0, 6)}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{statusText(note.status)}</h2>
              <p className="mt-1 text-sm text-muted">
                {note.transcriptText ? "Transcript loaded." : "Transcript will appear when async transcription finishes."}
              </p>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-border/60 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              Back
            </button>
          </div>

          <div className="mt-4">
            <WaveformPlayer audioUrl={note.audioUrl} peaks={note.waveformPeaks ?? []} />
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">Transcript</p>
            <div className="mt-2 rounded-2xl border border-border/60 bg-white/5 p-4">
              {isReady && note.transcriptText ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {note.transcriptText}
                </div>
              ) : (
                <div className="space-y-3">
                  <SkeletonBar className="w-[70%]" />
                  <SkeletonBar className="w-[90%]" />
                  <SkeletonBar className="w-[55%]" />
                  <SkeletonBar className="w-[78%]" />
                  <SkeletonBar className="w-[62%]" />
                  <div className="mt-2 text-xs text-muted">
                    {note.status === VoiceNoteStatusEnum.FAILED
                      ? "Transcription failed. Try re-recording."
                      : "Transcribing…"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="glass h-full p-6">
          <p className="text-sm font-medium">Insights</p>
          <p className="mt-2 text-xs text-muted">
            Quote, topics, takeaways, and action items derived asynchronously.
          </p>

          <div className="mt-4 rounded-2xl border border-border/60 bg-white/5 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Quote</p>
            {isReady && safeQuote ? (
              <p className="mt-2 text-sm leading-relaxed">{safeQuote}</p>
            ) : (
              <div className="mt-2 space-y-3">
                <SkeletonBar className="w-[80%]" />
                <SkeletonBar className="w-[65%]" />
              </div>
            )}

            {note.status === VoiceNoteStatusEnum.FAILED && typeof insights?.error === "string" ? (
              <div className="mt-3 text-xs text-accent3">{insights.error}</div>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Topics</p>
            {isReady && safeTopics.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {safeTopics.slice(0, 8).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/60 bg-white/5 px-3 py-1 text-xs text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <SkeletonBar className="w-[45%]" />
                <SkeletonBar className="w-[60%]" />
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Key takeaways</p>
            {isReady && safeKeyTakeaways.length ? (
              <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                {safeKeyTakeaways.slice(0, 6).map((t, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-border/60 bg-white/5 p-3"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 space-y-3">
                <SkeletonBar className="w-[95%]" />
                <SkeletonBar className="w-[80%]" />
                <SkeletonBar className="w-[88%]" />
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Action items</p>
            {isReady && safeActionItems.length ? (
              <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                {safeActionItems.slice(0, 6).map((t, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-border/60 bg-white/5 p-3"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 space-y-2">
                <SkeletonBar className="w-[70%]" />
                <SkeletonBar className="w-[50%]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

