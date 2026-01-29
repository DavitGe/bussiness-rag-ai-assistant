import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { embedText } from "@/lib/embeddings";
import { RAG_SYSTEM_PROMPT, buildRagUserPrompt } from "@/lib/ragPrompts";
import { ragResponseSchema, type RagResponse } from "@/lib/ragResponseSchema";

export interface RagVectorStoreLike {
  similaritySearch(
    queryEmbedding: number[],
    topK?: number,
  ): Array<{
    score: number;
    metadata: { name: string; pageOrSection: string; text: string };
  }>;
}

export interface QueryRagParams {
  question: string;
  vectorStore: RagVectorStoreLike;
  topK?: number;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_CHAT_MODEL = "gpt-3.5-turbo";

// Retrieval and safety thresholds:
// - cosine similarity is in [-1, 1] for normalized vectors.
// - below this threshold we treat chunks as "not relevant" to reduce noise/injection surface.
const MIN_RELEVANCE_SCORE = 0.2;
// If the model indicates low confidence, we force a deterministic "insufficient information" response.
const LOW_CONFIDENCE_THRESHOLD = 0.3;
// Limit excerpt size sent to the model (reduces prompt injection surface + token usage).
const MAX_EXCERPT_CHARS = 1200;

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const baseURL = process.env.OPENAI_BASE_URL;
  return new OpenAI({ apiKey, baseURL });
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  // Be tolerant to occasional provider preambles; extract the outermost JSON object.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model output did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function sanitizeExcerpt(text: string): string {
  // Keep this deterministic and minimal. JSON.stringify already escapes content;
  // this is primarily to bound size and remove problematic control characters.
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length <= MAX_EXCERPT_CHARS) return cleaned;
  return cleaned.slice(0, MAX_EXCERPT_CHARS).trim();
}

function insufficientInformationResponse(): RagResponse {
  return {
    answer: "Insufficient information based on the provided documents.",
    sourceDocuments: [],
    confidenceScore: 0,
    recommendation:
      "Provide or ingest additional documents that explicitly cover this question (policy, contract, spec, or relevant section).",
  };
}

async function callRagModel(args: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
}): Promise<string> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: args.model,
    temperature: 0,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
  });

  const parsed = chatCompletionSchema.parse(completion);
  const content = parsed.choices[0].message.content ?? "";
  return content.trim();
}

/**
 * End-to-end RAG query:
 * 1) embed question
 * 2) retrieve top-K chunks
 * 3) prompt with question + excerpts
 * 4) call LLM (server-side)
 * 5) parse + validate JSON
 * 6) retry once if invalid
 */
export async function queryRag(params: QueryRagParams): Promise<RagResponse> {
  const question = params.question.trim();
  if (question.length === 0) {
    throw new Error("queryRag: question must be non-empty");
  }

  const topK = params.topK ?? DEFAULT_TOP_K;

  const queryEmbedding = await embedText(question);
  const retrieved = params.vectorStore
    .similaritySearch(queryEmbedding, topK)
    .filter((r) => Number.isFinite(r.score) && r.score >= MIN_RELEVANCE_SCORE);

  if (retrieved.length === 0) {
    // Avoid calling the LLM when we have no relevant sources to ground the answer.
    return insufficientInformationResponse();
  }

  const excerpts = retrieved.map((r) => ({
    name: r.metadata.name,
    pageOrSection: r.metadata.pageOrSection,
    excerpt: sanitizeExcerpt(r.metadata.text),
  }));

  const userPrompt = buildRagUserPrompt({ question, excerpts });
  const model = process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;

  // Attempt 1
  const raw1 = await callRagModel({
    systemPrompt: RAG_SYSTEM_PROMPT,
    userPrompt,
    model,
  });

  try {
    const obj1 = extractJsonObject(raw1);
    const validated = ragResponseSchema.parse(obj1);
    if (validated.confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
      return insufficientInformationResponse();
    }
    return validated;
  } catch (err1) {
    // Attempt 2 (single retry): explicitly instruct to correct output shape.
    const repairPrompt = `
Your previous response was invalid.

Return ONLY a valid JSON object matching the required schema. Do not include any other text.

INVALID RESPONSE (for reference):
${raw1}
`.trim();

    const raw2 = await callRagModel({
      systemPrompt: RAG_SYSTEM_PROMPT,
      userPrompt: `${userPrompt}\n\n${repairPrompt}`,
      model,
    });

    const obj2 = extractJsonObject(raw2);
    const validated = ragResponseSchema.parse(obj2);
    if (validated.confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
      return insufficientInformationResponse();
    }
    return validated;
  }
}


