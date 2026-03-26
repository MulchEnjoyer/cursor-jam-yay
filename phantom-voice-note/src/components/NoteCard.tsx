import type { VoiceNoteStatus } from "@/generated/prisma/enums";
import ClickSpark from "./ClickSpark";

export type NoteSummary = {
  id: string;
  audioUrl: string;
  transcriptText: string | null;
  status: VoiceNoteStatus;
  createdAt: string | Date;
  durationSeconds: number | null;
};

function statusLabel(status: NoteSummary["status"]): string {
  switch (status) {
    case "READY":
      return "Ready";
    case "FAILED":
      return "Failed";
    case "IN_PROGRESS":
      return "Transcribing";
    case "PENDING":
      return "Transcribing";
    default:
      return "Unknown";
  }
}

function statusClass(status: NoteSummary["status"]): string {
  switch (status) {
    case "READY":
      return "text-accent2";
    case "FAILED":
      return "text-accent3";
    case "IN_PROGRESS":
    case "PENDING":
      return "text-muted";
    default:
      return "text-muted";
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const r = Math.round(seconds - m * 60);
  return `${m}m ${r}s`;
}

function formatCreatedAt(input: NoteSummary["createdAt"]): string {
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NoteCard(props: {
  note: NoteSummary;
  selected?: boolean;
  onSelect: (id: string) => void;
}) {
  const { note, selected, onSelect } = props;

  return (
    <ClickSpark block sparkColor="#fff" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
      <button
        type="button"
        onClick={() => onSelect(note.id)}
        className={[
          "w-full text-left transition",
          "rounded-xl border bg-white/5 px-5 py-4 hover:bg-white/8",
          "min-h-[108px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          selected
            ? "border-accent/70 shadow-[0_0_0_1px_rgba(124,92,255,0.35),0_18px_60px_rgba(0,0,0,0.55)]"
            : "border-border/60",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={["inline-flex h-2 w-2 rounded-full", statusClass(note.status)].join(" ")} />
              <p className={["text-xs font-mono uppercase tracking-widest", statusClass(note.status)].join(" ")}>
                {statusLabel(note.status)}
              </p>
              <span className="text-xs text-muted" style={{ opacity: 0.85 }}>
                {formatCreatedAt(note.createdAt)}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm text-muted" style={{ opacity: 0.95 }}>
              {note.transcriptText ? note.transcriptText : "Waiting for transcript…"}
            </p>
          </div>

          <div className="shrink-0 text-xs text-muted" style={{ opacity: 0.85 }}>
            {formatDuration(note.durationSeconds)}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-[2px] opacity-70" aria-hidden>
          {Array.from({ length: 56 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-sm bg-white/10"
              style={{ height: `${6 + ((i * 11) % 22)}px` }}
            />
          ))}
        </div>
      </button>
    </ClickSpark>
  );
}

