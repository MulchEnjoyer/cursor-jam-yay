"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { VoiceNoteStatus } from "@/generated/prisma/enums";
import ClickSpark from "./ClickSpark";

function getSupportedMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

async function computeWaveformPeaksFromBlob(blob: Blob, bars = 120): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioContextCtor = window.AudioContext
    ? window.AudioContext
    : (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  const ctx = new AudioContextCtor();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);

    const total = channel.length;
    if (!total) return [];

    const peakSamples = Math.max(16, bars);
    const blockSize = Math.max(1, Math.floor(total / peakSamples));
    const peaks: number[] = [];

    for (let i = 0; i < peakSamples; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, total);
      let max = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }

    const maxPeak = Math.max(...peaks, 0.0000001);
    return peaks.map((p) => p / maxPeak);
  } finally {
    await ctx.close();
  }
}

function formatSeconds(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}m ${r}s`;
}

type CreatedPayload = { id: string };

export function RecorderPanel(props: {
  onCreated: (payload: CreatedPayload) => void;
  variant?: "panel" | "floating";
}) {
  const { variant = "panel" } = props;
  const [mode, setMode] = useState<"idle" | "recording" | "processing" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewPeaks, setPreviewPeaks] = useState<number[] | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startAtRef = useRef<number>(0);

  const mimeType = useMemo(() => getSupportedMimeType(), []);

  const onStart = useCallback(async () => {
    setError(null);
    setPreviewPeaks(null);
    setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      chunksRef.current = chunks;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      startAtRef.current = Date.now();
      setMode("recording");

      const interval = window.setInterval(() => {
        const seconds = (Date.now() - startAtRef.current) / 1000;
        setElapsedSeconds(seconds);
      }, 100);

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        window.clearInterval(interval);
        stream.getTracks().forEach((t) => t.stop());

        try {
          setMode("processing");
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const durationSeconds = (Date.now() - startAtRef.current) / 1000;

          const peaks = await computeWaveformPeaksFromBlob(blob, 120);
          setPreviewPeaks(peaks);

          // Upload + create note
          setMode("uploading");
          const form = new FormData();
          const file = new File(
            [blob],
            `voice-note.${
              mimeType ? mimeType.split(";")[0].replaceAll("/", "-") : "webm"
            }`,
            {
              type: blob.type || "audio/webm",
            },
          );

          form.append("audio", file);
          form.append("durationSeconds", String(durationSeconds));
          form.append("waveformPeaks", JSON.stringify(peaks));

          const res = await fetch("/api/notes", { method: "POST", body: form });
          const data = (await res.json()) as { note?: { id: string }; error?: string };

          if (!res.ok || !data.note?.id) {
            throw new Error(data.error || "Failed to upload audio.");
          }

          props.onCreated({ id: data.note.id });
          setMode("idle");
          setElapsedSeconds(0);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setMode("error");
        }
      };

      recorder.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setMode("error");
    }
  }, [mimeType, props]);

  const onStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") recorder.stop();
  }, []);

  const isDisabled = mode === "processing" || mode === "uploading";

  if (variant === "floating") {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
        <div className="glass px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-widest" style={{ opacity: 0.75 }}>
                {mode === "recording" ? "Recording" : "Voice note"}
              </p>
              <p className="mt-1 text-xs" style={{ opacity: 0.85 }}>
                {mode === "recording"
                  ? `Time: ${formatSeconds(elapsedSeconds)}`
                  : mode === "processing"
                    ? "Computing waveform…"
                    : mode === "uploading"
                      ? "Uploading audio…"
                      : error
                        ? "Upload failed"
                        : "Tap to create an audio note"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {previewPeaks ? (
                <div className="hidden sm:block">
                  <div className="flex h-8 items-end gap-[1px] rounded-lg border border-border/50 bg-white/5 p-2">
                    {previewPeaks.slice(0, 44).map((p, i) => (
                      <div
                        key={i}
                        className="w-[2px] rounded-sm bg-accent2/70"
                        style={{ height: `${Math.max(2, Math.round(p * 26))}px` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {mode !== "recording" ? (
                <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                  <button
                    type="button"
                    className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background shadow-[0_0_0_1px_rgba(124,92,255,0.35)] transition hover:brightness-110 disabled:opacity-60"
                    onClick={() => void onStart()}
                    disabled={isDisabled}
                  >
                    Start
                  </button>
                </ClickSpark>
              ) : (
                <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition hover:bg-white/15 disabled:opacity-60"
                    onClick={onStop}
                    disabled={isDisabled}
                  >
                    Stop
                  </button>
                </ClickSpark>
              )}

              <span
                className={
                  mode === "recording"
                    ? "inline-flex h-2.5 w-2.5 rounded-full bg-accent3 shadow-[0_0_20px_rgba(255,79,216,0.55)]"
                    : "inline-flex h-2.5 w-2.5 rounded-full bg-border"
                }
                aria-hidden
              />
            </div>
          </div>
          {error ? (
            <div className="mt-2 rounded-xl border border-accent3/40 bg-accent3/10 p-2">
              <p className="text-xs font-medium text-accent3">{error}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Record</p>
          <h2 className="mt-1 text-lg font-semibold">Voice note</h2>
          <p className="mt-2 text-sm text-muted">
            {mode === "recording" ? "Capturing audio..." : "Create an audio note and get transcript + insights."}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-muted">
            {mode === "recording" ? `Recording: ${formatSeconds(elapsedSeconds)}` : "\u00A0"}
          </div>

          <div className="flex items-center gap-2">
            {mode !== "recording" ? (
              <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <button
                  type="button"
                  className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background shadow-[0_0_0_1px_rgba(124,92,255,0.35)] transition hover:brightness-110 disabled:opacity-60"
                  onClick={() => void onStart()}
                  disabled={isDisabled}
                >
                  Start
                </button>
              </ClickSpark>
            ) : (
              <ClickSpark sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition hover:bg-white/15 disabled:opacity-60"
                  onClick={onStop}
                  disabled={isDisabled}
                >
                  Stop
                </button>
              </ClickSpark>
            )}

            <span
              className={
                mode === "recording"
                  ? "inline-flex h-2.5 w-2.5 rounded-full bg-accent3 shadow-[0_0_20px_rgba(255,79,216,0.55)]"
                  : "inline-flex h-2.5 w-2.5 rounded-full bg-border"
              }
              aria-hidden
            />
          </div>
        </div>
      </div>

      {previewPeaks ? (
        <div className="mt-5">
          <p className="text-xs text-muted">Waveform preview</p>
          <div className="mt-2 flex h-10 items-end gap-[1px] rounded-xl border border-border/50 bg-white/5 p-2">
            {previewPeaks.slice(0, 96).map((p, i) => (
              <div
                key={i}
                className="w-[2px] rounded-sm bg-accent2/70"
                style={{ height: `${Math.max(2, Math.round(p * 32))}px` }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-accent3/40 bg-accent3/10 p-3">
          <p className="text-sm font-medium text-accent3">Upload error</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
        </div>
      ) : null}

      {mode === "processing" || mode === "uploading" ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-white/5 p-3">
          <p className="text-sm font-medium">{mode === "processing" ? "Computing waveform..." : "Uploading audio..."}</p>
          <p className="mt-1 text-sm text-muted">
            {mode === "uploading" ? `Status: ${VoiceNoteStatus.PENDING}` : "\u00A0"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

