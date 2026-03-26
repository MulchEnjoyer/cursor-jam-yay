import { put } from "@vercel/blob";

function guessExtension(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("wav")) return "wav";
  if (t.includes("mp3")) return "mp3";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function uploadToBlobAudio(params: {
  noteId: string;
  file: {
    type?: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
}): Promise<{ audioUrl: string; objectKey: string }> {
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  // On Vercel deployments where your Blob store is in the same project, the SDK
  // automatically picks up the store token from `BLOB_READ_WRITE_TOKEN`.
  if (!isVercel) requiredEnv("BLOB_READ_WRITE_TOKEN");

  const ext = guessExtension(params.file.type || "");
  const objectKey = `audio/${params.noteId}.${ext}`;

  const body = Buffer.from(await params.file.arrayBuffer());

  const uploaded = await put(objectKey, body, {
    access: "public",
    contentType: params.file.type || "application/octet-stream",
    // `noteId` is a UUID so we shouldn't collide, but keep it deterministic anyway.
    addRandomSuffix: false,
    multipart: true,
  });

  return { audioUrl: uploaded.url, objectKey: uploaded.pathname };
}

