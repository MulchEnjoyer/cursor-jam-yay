import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VoiceNoteStatus } from "@/generated/prisma/enums";
import { transcribeAndSummarizeWithGeminiFlash } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const note = await prisma.voiceNote.findUnique({
    where: { id },
    select: { id: true, audioUrl: true, status: true },
  });

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If a second invocation races ahead, don't clobber READY results.
  if (note.status === VoiceNoteStatus.READY) {
    return NextResponse.json({ ok: true, alreadyReady: true });
  }

  try {
    const result = await transcribeAndSummarizeWithGeminiFlash(note.audioUrl);

    await prisma.voiceNote.update({
      where: { id: note.id },
      data: {
        status: VoiceNoteStatus.READY,
        transcriptText: result.transcriptText,
        insights: result.insights,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.voiceNote.update({
      where: { id: note.id },
      data: {
        status: VoiceNoteStatus.FAILED,
        insights: {
          error: message,
        },
      },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

