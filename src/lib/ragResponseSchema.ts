import { z } from "zod";

/**
 * Schema describing the normalized RAG response shape.
 * Enforces strict, predictable JSON for downstream consumers.
 */
export const ragSourceDocumentSchema = z.object({
  name: z.string(),
  pageOrSection: z.string(),
  excerpt: z.string(),
});

export const ragResponseSchema = z.object({
  answer: z.string(),
  sourceDocuments: z.array(ragSourceDocumentSchema),
  confidenceScore: z.number().min(0).max(1),
  recommendation: z.string(),
});

export type RagSourceDocument = z.infer<typeof ragSourceDocumentSchema>;
export type RagResponse = z.infer<typeof ragResponseSchema>;


