import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VoiceNoteStatus } from "@/generated/prisma/enums";
import { uploadToR2Audio } from "@/lib/r2";

export const runtime = "nodejs";

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumberArray(value: unknown): number[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const nums = value.map((v) => Number(v));
    return nums.every((n) => Number.isFinite(n)) ? nums : undefined;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const nums = parsed.map((v) => Number(v));
        return nums.every((n) => Number.isFinite(n)) ? nums : undefined;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const id = crypto.randomUUID();

  let audioUrl: string | undefined;
  let durationSeconds: number | undefined;
  let waveformPeaks: number[] | undefined;

  if (contentType.includes("application/json")) {
    const bodyUnknown: unknown = await req.json();
    if (typeof bodyUnknown !== "object" || bodyUnknown === null) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const body = bodyUnknown as Record<string, unknown>;
    audioUrl = typeof body.audioUrl === "string" ? body.audioUrl : undefined;
    durationSeconds = parseNumber(body.durationSeconds);
    waveformPeaks = parseNumberArray(body.waveformPeaks);
  } else {
    const form = await req.formData();
    const audio = form.get("audio");
    if (
      !audio ||
      typeof (audio as { arrayBuffer?: unknown }).arrayBuffer !== "function"
    ) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with an `audio` file field." },
        { status: 400 },
      );
    }

    const file = audio as unknown as { type?: string; arrayBuffer: () => Promise<ArrayBuffer> };

    durationSeconds = parseNumber(form.get("durationSeconds"));
    waveformPeaks = parseNumberArray(form.get("waveformPeaks"));

    try {
      const uploaded = await uploadToR2Audio({ noteId: id, file });
      audioUrl = uploaded.audioUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!audioUrl) {
    return NextResponse.json({ error: "audioUrl is required." }, { status: 400 });
  }

  const note = await prisma.voiceNote.create({
    data: {
      id,
      audioUrl,
      durationSeconds,
      waveformPeaks: waveformPeaks ?? [],
      status: VoiceNoteStatus.PENDING,
    },
    select: {
      id: true,
      audioUrl: true,
      transcriptText: true,
      status: true,
      createdAt: true,
      durationSeconds: true,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);

  const notes = await prisma.voiceNote.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      audioUrl: true,
      transcriptText: true,
      status: true,
      createdAt: true,
      durationSeconds: true,
    },
  });

  return NextResponse.json({ notes });
}

