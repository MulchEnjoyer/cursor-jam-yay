import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { Readable as NodeReadable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

// These images live outside the Next.js project directory (Cursor asset picker output).
// We serve them from an allow-list so the UI can use them as CSS backgrounds.
const THUMB_DIR = "/Users/arenung/.cursor/projects/Users-arenung-Cursor-Jam/assets";
const ALLOWED = new Set([
  "image-12706ffa-4891-4f98-a721-5a678ed2c6bd.png",
  "image-3c855676-25ed-4863-8ba1-b9cb84b70ceb.png",
  "image-5415624a-9d77-4bdb-8289-e91dc8254d41.png",
  "image-6cc63c2e-c970-4089-8c46-cdb603ed63a7.png",
  "image-a3ad49c5-34b8-4824-bd75-7b233750fdb2.png",
  "image-dfca0ec8-25e5-4de5-87c7-44321d6d8b10.png",
  "image-ea094650-d32d-43c1-a96a-6ff2297ac408.png",
]);

function isAllowedName(name: string): boolean {
  return ALLOWED.has(name);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  if (!isAllowedName(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(THUMB_DIR, name);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const webStream = NodeReadable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

