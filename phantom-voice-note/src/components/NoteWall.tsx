"use client";

import { NoteCard, type NoteSummary } from "@/components/NoteCard";

export function NoteWall(props: {
  notes: NoteSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { notes, selectedId, onSelect } = props;

  return (
    <div className="glass p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Voice notes</h2>
          <p className="mt-2 text-muted">
            Scroll the panels. Tap one to open transcript + insights.
          </p>
        </div>

        <div className="text-xs text-muted">{notes.length} notes</div>
      </div>

      {notes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-white/5 p-8">
          <p className="text-sm font-medium">No notes yet</p>
          <p className="mt-2 text-sm text-muted">
            Record your first voice note above. We’ll transcribe it asynchronously and make it searchable.
          </p>
        </div>
      ) : (
        <div
          className={[
            "mt-6",
            "max-h-[calc(100vh-270px)] overflow-y-auto overscroll-contain",
            "pr-2 [scrollbar-gutter:stable]",
            "space-y-3",
          ].join(" ")}
        >
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} selected={selectedId === n.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

