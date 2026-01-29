import "server-only";

import { embedText } from "@/lib/embeddings";
import type { DocumentChunk, VectorMetadata } from "@/lib/vectorStore";

export interface VectorStoreLike {
  addDocuments(chunks: DocumentChunk[]): void;
}

export interface IngestTextParams {
  documentName: string;
  text: string;
  /**
   * Optional label used as a prefix for `pageOrSection` metadata.
   * Helpful if you ingest text that already corresponds to a known section.
   */
  sectionLabel?: string;
}

export interface IngestTextOptions {
  /**
   * Target max size for a chunk, in approximate tokens.
   * We use a deterministic heuristic (chars/4) to estimate tokens without a tokenizer.
   */
  maxTokensPerChunk?: number;
  /**
   * If true, tries harder to keep paragraph boundaries; otherwise may split long paragraphs.
   */
  preferParagraphBoundaries?: boolean;
}

export interface IngestTextResult {
  chunksAdded: number;
}

const DEFAULT_MAX_TOKENS_PER_CHUNK = 500;

/**
 * Ingest raw text into a vector store:
 * - deterministic chunking (paragraph-first)
 * - embeddings per chunk (server-side)
 * - store chunks with metadata for retrieval
 */
export async function ingestText(
  vectorStore: VectorStoreLike,
  params: IngestTextParams,
  options: IngestTextOptions = {},
) : Promise<IngestTextResult> {
  const documentName = params.documentName.trim();
  if (documentName.length === 0) {
    throw new Error("ingestText: documentName must be non-empty");
  }

  const raw = params.text.replace(/\r\n/g, "\n").trim();
  if (raw.length === 0) {
    return { chunksAdded: 0 };
  }

  const maxTokensPerChunk =
    options.maxTokensPerChunk ?? DEFAULT_MAX_TOKENS_PER_CHUNK;
  const preferParagraphBoundaries = options.preferParagraphBoundaries ?? true;

  const chunkTexts = chunkText(raw, {
    maxTokensPerChunk,
    preferParagraphBoundaries,
  });

  const chunks: DocumentChunk[] = [];

  // Sequential embedding for deterministic ordering and predictable rate limiting.
  for (let i = 0; i < chunkTexts.length; i += 1) {
    const chunkTextValue = chunkTexts[i];
    const embedding = await embedText(chunkTextValue);

    const pageOrSectionPrefix = params.sectionLabel?.trim();
    const pageOrSection = pageOrSectionPrefix
      ? `${pageOrSectionPrefix} (chunk ${i + 1})`
      : `chunk ${i + 1}`;

    const metadata: VectorMetadata = {
      name: documentName,
      pageOrSection,
      text: chunkTextValue,
    };

    chunks.push({ embedding, metadata });
  }

  vectorStore.addDocuments(chunks);
  return { chunksAdded: chunks.length };
}

function chunkText(
  text: string,
  config: {
    maxTokensPerChunk: number;
    preferParagraphBoundaries: boolean;
  },
): string[] {
  const paragraphs = splitIntoParagraphs(text);
  const maxTokens = Math.max(1, Math.floor(config.maxTokensPerChunk));

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
    buffer = "";
  };

  for (const p of paragraphs) {
    const paragraph = p.trim();
    if (paragraph.length === 0) {
      continue;
    }

    if (buffer.length === 0) {
      if (estimateTokens(paragraph) <= maxTokens) {
        buffer = paragraph;
        continue;
      }

      // Paragraph is too large to fit; split it deterministically.
      const split = splitLongText(paragraph, maxTokens);
      for (const piece of split) {
        if (estimateTokens(piece) <= maxTokens) {
          chunks.push(piece);
        } else {
          // Fallback: very defensive; should not happen, but keep invariants.
          chunks.push(...splitByChars(piece, maxTokens));
        }
      }
      continue;
    }

    const candidate = `${buffer}\n\n${paragraph}`;
    if (estimateTokens(candidate) <= maxTokens) {
      buffer = candidate;
      continue;
    }

    // Candidate would exceed max size; flush buffer.
    flush();

    if (estimateTokens(paragraph) <= maxTokens) {
      buffer = paragraph;
      continue;
    }

    // Paragraph alone is too large; split it.
    if (config.preferParagraphBoundaries) {
      const split = splitLongText(paragraph, maxTokens);
      chunks.push(...split);
    } else {
      chunks.push(...splitByChars(paragraph, maxTokens));
    }
  }

  flush();
  return chunks;
}

function splitIntoParagraphs(text: string): string[] {
  // Split on blank lines while keeping deterministic normalization.
  return text
    .split(/\n\s*\n+/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Estimate token count without a tokenizer.
 * Deterministic heuristic: tokens ≈ chars / 4.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitLongText(text: string, maxTokensPerChunk: number): string[] {
  // First try sentence boundaries; if still too large, fall back to char splitting.
  const sentences = splitIntoSentences(text);
  if (sentences.length <= 1) {
    return splitByChars(text, maxTokensPerChunk);
  }

  const maxTokens = Math.max(1, Math.floor(maxTokensPerChunk));
  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
    buffer = "";
  };

  for (const s of sentences) {
    const sentence = s.trim();
    if (sentence.length === 0) continue;

    if (buffer.length === 0) {
      if (estimateTokens(sentence) <= maxTokens) {
        buffer = sentence;
      } else {
        chunks.push(...splitByChars(sentence, maxTokens));
      }
      continue;
    }

    const candidate = `${buffer} ${sentence}`;
    if (estimateTokens(candidate) <= maxTokens) {
      buffer = candidate;
    } else {
      flush();
      if (estimateTokens(sentence) <= maxTokens) {
        buffer = sentence;
      } else {
        chunks.push(...splitByChars(sentence, maxTokens));
      }
    }
  }

  flush();
  return chunks;
}

function splitIntoSentences(text: string): string[] {
  // Deterministic and simple: split on sentence-ending punctuation followed by whitespace.
  // This is intentionally conservative; PDF cleanup will be added later.
  return text
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitByChars(text: string, maxTokensPerChunk: number): string[] {
  // tokens ≈ chars/4, so maxChars ≈ maxTokens*4
  const maxChars = Math.max(16, Math.floor(maxTokensPerChunk) * 4);
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    const slice = text.slice(i, end).trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
    i = end;
  }

  return chunks;
}


