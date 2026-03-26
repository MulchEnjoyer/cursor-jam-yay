import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VoiceNoteStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const note = await prisma.voiceNote.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (note.status === VoiceNoteStatus.READY) {
    return NextResponse.json({ queued: false, reason: "already-ready" });
  }

  if (note.status === VoiceNoteStatus.IN_PROGRESS) {
    return NextResponse.json({ queued: false, reason: "already-in-progress" });
  }

  await prisma.voiceNote.update({
    where: { id: note.id },
    data: { status: VoiceNoteStatus.IN_PROGRESS },
  });

  // Fire-and-forget a second invocation to avoid request timeouts.
  const runUrl = `${getBaseUrl()}/api/notes/${note.id}/transcribe/run`;
  void fetch(runUrl, { method: "POST" }).catch(() => {
    // The run invocation will still be attempted; errors will surface in DB status.
  });

  return NextResponse.json({ queued: true });
}

