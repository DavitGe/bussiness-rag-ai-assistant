import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { ingestText } from "@/lib/ingestion";
import { getVectorStore, upsertDocument } from "@/lib/ragState";
import { seedVectorStoreOnce } from "@/lib/regState";

export const runtime = "nodejs";

const ingestRequestSchema = z.object({
  documentName: z.string().trim().min(1),
  text: z.string().min(1),
  sectionLabel: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    // Ensure default documents are available as soon as the server handles requests.
    await seedVectorStoreOnce();

    const body = await req.json();
    const input = ingestRequestSchema.parse(body);

    const vectorStore = getVectorStore();
    const result = await ingestText(vectorStore, {
      documentName: input.documentName,
      text: input.text,
      sectionLabel: input.sectionLabel,
    });

    upsertDocument({ name: input.documentName, text: input.text });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: err.flatten() },
        { status: 400 },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "Ingestion failed", message },
      { status: 500 },
    );
  }
}


