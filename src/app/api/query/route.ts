import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { queryRag } from "@/lib/queryRag";
import { getVectorStore } from "@/lib/ragState";
import { seedVectorStoreOnce } from "@/lib/regState";

export const runtime = "nodejs";

const MAX_QUERY_CHARS = 4000;

const queryRequestSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_CHARS),
  topK: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: Request) {
  try {
    // Ensure default documents are available as soon as the server handles requests.
    await seedVectorStoreOnce();

    const body = await req.json();
    const input = queryRequestSchema.parse(body);
    const vectorStore = getVectorStore();
    const result = await queryRag({
      question: input.query,
      vectorStore,
      topK: input.topK,
    });

    // `queryRag` returns a Zod-validated response matching the RAG response schema.
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: err.flatten() },
        { status: 400 },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "Query failed", message, },
      { status: 500 },
    );
  }
}


