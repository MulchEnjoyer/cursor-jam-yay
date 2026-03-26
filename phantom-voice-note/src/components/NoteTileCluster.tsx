"use client";

import { useMemo, type CSSProperties } from "react";
import type { NoteSummary } from "@/components/NoteCard";
import ClickSpark from "./ClickSpark";
import type { VoiceNoteStatus } from "@/generated/prisma/enums";

const THUMBS = [
  "image-12706ffa-4891-4f98-a721-5a678ed2c6bd.png",
  "image-3c855676-25ed-4863-8ba1-b9cb84b70ceb.png",
  "image-5415624a-9d77-4bdb-8289-e91dc8254d41.png",
  "image-6cc63c2e-c970-4089-8c46-cdb603ed63a7.png",
  "image-a3ad49c5-34b8-4824-bd75-7b233750fdb2.png",
  "image-dfca0ec8-25e5-4de5-87c7-44321d6d8b10.png",
  "image-ea094650-d32d-43c1-a96a-6ff2297ac408.png",
] as const;

function hashStringToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
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

function statusDotClass(status: VoiceNoteStatus): string {
  switch (status) {
    case "READY":
      return "bg-accent2";
    case "FAILED":
      return "bg-accent3";
    case "IN_PROGRESS":
    case "PENDING":
      return "bg-white/40";
    default:
      return "bg-white/40";
  }
}

function thumbForId(id: string): (typeof THUMBS)[number] {
  const idx = hashStringToInt(id) % THUMBS.length;
  return THUMBS[idx];
}

export function NoteTileCluster(props: {
  notes: NoteSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { notes, selectedId, onSelect } = props;

  const tiles = useMemo(() => {
    const tileSeeds = notes.map((n) => hashStringToInt(n.id));
    return notes.map((n, i) => {
      const rng = mulberry32(tileSeeds[i] ?? i + 1);
      const angle = rng() * Math.PI * 2;
      const radius = 14 + rng() * 28; // percent space inside the cluster box
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius * 0.78;
      const rot = (rng() - 0.5) * 14;

      // Slightly bias toward a “cinematic wall” feel by pushing some cards outward.
      const outward = rng();
      const depth = 10 + outward * 22; // px shadow-ish depth
      const zIndex = Math.floor(outward * 100);

      return { note: n, x, y, rot, depth, zIndex, thumb: thumbForId(n.id) };
    });
  }, [notes]);

  if (notes.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="relative aspect-[4/3] sm:aspect-square">
        {tiles.map((t) => {
          const isSelected = selectedId === t.note.id;
          return (
            <ClickSpark
              key={t.note.id}
              sparkColor="#ffffff"
              sparkSize={9}
              sparkRadius={12}
              sparkCount={7}
              duration={380}
            >
              <button
                type="button"
                onClick={() => onSelect(t.note.id)}
                className={[
                  "absolute select-none rounded-xl border transition",
                  "w-[70px] h-[70px] sm:w-[82px] sm:h-[82px] md:w-[98px] md:h-[98px]",
                  "bg-white/5 hover:bg-white/8",
                  "outline-none",
                  isSelected ? "border-accent/70 shadow-[0_0_0_1px_rgba(124,92,255,0.45),0_20px_55px_rgba(0,0,0,0.65)]" : "border-border/55",
                  "focus-visible:ring-2 focus-visible:ring-accent/60",
                ].join(" ")}
                style={
                  {
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    transform: `translate(-50%,-50%) rotate(${t.rot}deg)`,
                    zIndex: t.zIndex,
                    boxShadow: isSelected ? "0 0 0 1px rgba(124,92,255,0.25)" : `0 ${t.depth}px ${t.depth * 2}px rgba(0,0,0,0.55)`,
                    backgroundImage: `url(/api/note-thumbs/${encodeURIComponent(t.thumb)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: isSelected ? "saturate(1.25) contrast(1.05)" : "saturate(1.05) contrast(1.02)",
                  } as CSSProperties
                }
                aria-label="Open note"
              >
                <div className="absolute inset-0 rounded-xl bg-black/20" />
                <div className="absolute inset-0 rounded-xl ring-1 ring-white/5" />

                <div className="absolute left-2 top-2 flex items-center gap-2">
                  <span className={["inline-flex h-[7px] w-[7px] rounded-full", statusDotClass(t.note.status)].join(" ")} />
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ opacity: 0.75 }}>
                    {t.note.status === "READY"
                      ? "Ready"
                      : t.note.status === "FAILED"
                        ? "Failed"
                        : "Transcribing"}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-2 px-2">
                  <p
                    className="text-[11px] leading-tight overflow-hidden"
                    style={{
                      maxHeight: "2.5em",
                      opacity: isSelected ? 0.95 : 0.0,
                      transition: "opacity 180ms ease",
                    }}
                  >
                    {t.note.transcriptText ? t.note.transcriptText : "Tap to view transcript"}
                  </p>
                </div>
              </button>
            </ClickSpark>
          );
        })}

        {/* Central “stage” glow so the cluster reads like a single unit. */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_50%_45%,rgba(124,92,255,0.14),transparent_52%)]" />
      </div>
    </div>
  );
}

