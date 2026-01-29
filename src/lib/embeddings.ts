import "server-only";

import OpenAI from "openai";
import { z } from "zod";

const embeddingResponseSchema = z.object({
  data: z
    .array(
      z.object({
        embedding: z.array(z.number()),
      }),
    )
    .min(1),
});

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  // Supports OpenAI-compatible providers (e.g., self-hosted gateways) via baseURL.
  const baseURL = process.env.OPENAI_BASE_URL;

  return new OpenAI({ apiKey, baseURL });
}

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Embed a single text string using a small, cost-efficient embedding model.
 *
 * Server-side only: this module imports `server-only` to prevent client bundling.
 */
export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();
  if (input.length === 0) {
    throw new Error("embedText: input text must be non-empty");
  }

  const model = process.env.OPENAI_EMBEDDINGS_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model,
    input,
  });

  const parsed = embeddingResponseSchema.parse(response);
  return parsed.data[0].embedding;
}


