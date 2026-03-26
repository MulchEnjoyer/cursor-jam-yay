"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VoiceNoteStatus } from "@/generated/prisma/enums";
import type { NoteSummary } from "@/components/NoteCard";
import { NoteWall } from "@/components/NoteWall";
import { RecorderPanel } from "@/components/RecorderPanel";
import { SplitView, type NoteDetail } from "@/components/SplitView";

type NotesListResponse = { notes: NoteSummary[] };

function isNoteStatus(value: unknown): value is VoiceNoteStatus {
  return (
    value === "PENDING" ||
    value === "IN_PROGRESS" ||
    value === "READY" ||
    value === "FAILED"
  );
}

function normalizeNoteSummary(input: unknown): NoteSummary {
  const obj = input as Record<string, unknown> | null;
  const status = obj?.status;
  return {
    id: typeof obj?.id === "string" ? obj.id : String(obj?.id ?? ""),
    audioUrl: typeof obj?.audioUrl === "string" ? obj.audioUrl : String(obj?.audioUrl ?? ""),
    transcriptText:
      typeof obj?.transcriptText === "string" ? obj.transcriptText : null,
    status: isNoteStatus(status) ? status : "PENDING",
    createdAt: obj?.createdAt ? new Date(String(obj.createdAt)).toISOString() : new Date().toISOString(),
    durationSeconds:
      typeof obj?.durationSeconds === "number" ? obj.durationSeconds : null,
  };
}

function normalizeNoteDetail(input: unknown): NoteDetail {
  const obj = input as Record<string, unknown> | null;
  return {
    id: typeof obj?.id === "string" ? obj.id : String(obj?.id ?? ""),
    audioUrl: typeof obj?.audioUrl === "string" ? obj.audioUrl : String(obj?.audioUrl ?? ""),
    transcriptText:
      typeof obj?.transcriptText === "string" ? obj.transcriptText : null,
    status: isNoteStatus(obj?.status) ? (obj?.status as VoiceNoteStatus) : "PENDING",
    insights: (obj?.insights ?? null) as NoteDetail["insights"],
    waveformPeaks: Array.isArray(obj?.waveformPeaks)
      ? obj.waveformPeaks.map((v) => (typeof v === "number" ? v : 0))
      : [],
    durationSeconds:
      typeof obj?.durationSeconds === "number" ? obj.durationSeconds : null,
    createdAt: obj?.createdAt ? new Date(String(obj.createdAt)).toISOString() : new Date().toISOString(),
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function makeDummyPeaks(seed: number, count = 120): number[] {
  const rng = mulberry32(seed);
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    // A speech-like envelope: more energy in the middle.
    const t = i / (count - 1);
    const envelope = Math.sin(Math.PI * t) ** 0.75;
    const burst = 0.25 + rng() * 0.75;
    peaks.push(Math.min(1, envelope * burst));
  }
  return peaks;
}

function makeDummyNotes(): Array<{ summary: NoteSummary; detail: NoteDetail }> {
  const templates: Array<{
    transcript: string;
    status: VoiceNoteStatus;
    durationSeconds: number;
    quote: string;
    topics: string[];
    keyTakeaways: string[];
    actionItems: string[];
  }> = [
    {
      transcript: "I can still hear the rain on the balcony rail like it was a metronome.",
      status: "READY",
      durationSeconds: 47,
      quote: "Some memories are just rhythm you can replay.",
      topics: ["nostalgia", "sound", "focus"],
      keyTakeaways: ["Build moments around sensory anchors", "Small sounds become structure"],
      actionItems: ["Write a one-paragraph sensory journal entry", "Pick a soundtrack for deep work"],
    },
    {
      transcript: "We kept talking in circles, but the answer was always in the first sentence.",
      status: "READY",
      durationSeconds: 32,
      quote: "Clarity comes from returning to the premise.",
      topics: ["communication", "clarity", "decision-making"],
      keyTakeaways: ["State the premise early", "Summarize before iterating"],
      actionItems: ["Draft a one-line goal statement", "Run a quick premise-check before meetings"],
    },
    {
      transcript: "When the lights flickered, I realized how often I ignore the obvious.",
      status: "READY",
      durationSeconds: 41,
      quote: "The obvious is often the most useful signal.",
      topics: ["awareness", "systems", "attention"],
      keyTakeaways: ["Notice small anomalies", "Prefer simple, testable hypotheses"],
      actionItems: ["List three ‘obvious’ improvements", "Schedule a 10-minute review every Friday"],
    },
    {
      transcript: "I thought it was burnout, but it was just a mismatch between effort and impact.",
      status: "READY",
      durationSeconds: 56,
      quote: "Burnout is sometimes misallocation, not exhaustion.",
      topics: ["strategy", "energy", "prioritization"],
      keyTakeaways: ["Aim effort at leverage points", "Measure outcomes, not activity"],
      actionItems: ["Choose one high-leverage metric", "Stop one low-impact habit this week"],
    },
    {
      transcript: "The city felt quiet for the first time in months, so I finally listened.",
      status: "READY",
      durationSeconds: 38,
      quote: "Quiet creates enough space to notice yourself.",
      topics: ["reflection", "calm", "self-awareness"],
      keyTakeaways: ["Use pauses to reset perspective", "Let thoughts pass without fixing them"],
      actionItems: ["Take a short walk without headphones", "Write down one insight you usually skip"],
    },
    {
      transcript: "I’m learning to treat constraints like creative collaborators.",
      status: "READY",
      durationSeconds: 45,
      quote: "Constraints turn vague ideas into concrete choices.",
      topics: ["creativity", "constraints", "iteration"],
      keyTakeaways: ["Reduce options to increase output", "Prototype fast, refine later"],
      actionItems: ["Set a 30-minute prototype timer", "Pick one constraint to lean into tomorrow"],
    },
    {
      transcript: "The conversation ended, but the problem stayed—so I wrote it down.",
      status: "READY",
      durationSeconds: 29,
      quote: "When discussions stop, the notes keep going.",
      topics: ["capture", "documentation", "momentum"],
      keyTakeaways: ["Write the problem as a sentence", "Add one next action immediately"],
      actionItems: ["Turn the problem into a single question", "Create a ‘next step’ checklist"],
    },
    {
      transcript: "I didn’t need more motivation. I needed a smaller starting line.",
      status: "READY",
      durationSeconds: 52,
      quote: "Momentum favors small beginnings.",
      topics: ["habits", "motivation", "execution"],
      keyTakeaways: ["Lower the entry threshold", "Make the next action obvious"],
      actionItems: ["Define a 2-minute start ritual", "Prep materials the night before"],
    },
  ];

  const count = 24;
  const notes: Array<{ summary: NoteSummary; detail: NoteDetail }> = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    const id = `dummy-${i + 1}`;
    const seed = hashStringToInt(id);
    const createdAt = new Date(Date.now() - (i + 1) * 1000 * 60 * 17).toISOString();
    const waveformPeaks = makeDummyPeaks(seed, 140);
    const transcriptText = t.transcript + (i % 3 === 0 ? " (replayed in my head.)" : "");

    const status: VoiceNoteStatus = i % 11 === 0 ? "IN_PROGRESS" : i % 13 === 0 ? "FAILED" : t.status;

    notes.push({
      summary: {
        id,
        audioUrl: "",
        transcriptText,
        status,
        createdAt,
        durationSeconds: t.durationSeconds + (i % 5) * 3,
      },
      detail: {
        id,
        audioUrl: "",
        transcriptText,
        status,
        insights:
          status === "FAILED"
            ? { error: "Dummy preview: transcription failed." }
            : {
                quote: t.quote,
                topics: t.topics,
                keyTakeaways: t.keyTakeaways,
                actionItems: t.actionItems,
              },
        waveformPeaks,
        durationSeconds: t.durationSeconds + (i % 5) * 3,
        createdAt,
      },
    });
  }

  return notes;
}

export function PhantomExplorer() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null);

  const [dummyNotes] = useState(() => makeDummyNotes());
  const dummyDetailMap = useMemo(() => new Map(dummyNotes.map((d) => [d.summary.id, d.detail])), [dummyNotes]);
  const dummySummaries = useMemo(() => dummyNotes.map((d) => d.summary), [dummyNotes]);

  const fetchNotes = useCallback(async () => {
    const res = await fetch("/api/notes?limit=50", { method: "GET" });
    if (!res.ok) return;
    const data = (await res.json()) as NotesListResponse;
    const normalized = data.notes?.map(normalizeNoteSummary) ?? [];
    setNotes(normalized);
  }, []);

  const fetchSelected = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: "GET" });
    if (!res.ok) return;
    const data = (await res.json()) as { note: unknown };
    if (!data.note) return;
    setSelectedNote(normalizeNoteDetail(data.note));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchNotes();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchNotes();
    }, 4000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [fetchNotes]);

  useEffect(() => {
    if (!selectedId) return;
    const done =
      selectedNote?.status === "READY" || selectedNote?.status === "FAILED";
    const timeout = window.setTimeout(() => {
      if (!done) void fetchSelected(selectedId);
    }, 0);
    const interval = window.setInterval(() => {
      if (done) return;
      void fetchSelected(selectedId);
    }, 2500);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [selectedId, selectedNote?.status, fetchSelected]);

  const onCreated = useCallback(
    (payload: { id: string }) => {
      setSelectedId(payload.id);
      // Refresh list quickly; detail will be fetched by effect.
      void fetchNotes();
    },
    [fetchNotes],
  );

  const onSelectTile = useCallback(
    (id: string) => {
      setSelectedId(id);
      const dummyDetail = dummyDetailMap.get(id);
      if (dummyDetail) setSelectedNote(dummyDetail);
      else setSelectedNote(null);
    },
    [dummyDetailMap],
  );

  const onBack = useCallback(() => {
    setSelectedId(null);
    setSelectedNote(null);
  }, []);

  const header = (
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest" style={{ opacity: 0.8 }}>
          SIFNA
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">
          Voice notes, transcribed and explored like a cinematic wall.
        </h1>
      </div>
      <div className="hidden lg:block">
        <button
          type="button"
          className="rounded-full border border-border/60 bg-white/5 px-4 py-2 text-sm font-medium"
          style={{ opacity: 0.9 }}
          aria-label="Menu"
        >
          Menu
        </button>
      </div>
    </header>
  );

  const displayNotes = selectedId ? notes : [...dummySummaries, ...notes.slice(0, 10)];

  const content = selectedId ? (
    <SplitView note={selectedNote} onBack={onBack} />
  ) : (
    <NoteWall notes={displayNotes} selectedId={selectedId} onSelect={onSelectTile} />
  );

  return (
    <div className="relative pb-[170px]">
      {header}
      <div className="mt-6">{content}</div>
      <RecorderPanel onCreated={onCreated} variant="floating" />
    </div>
  );
}

