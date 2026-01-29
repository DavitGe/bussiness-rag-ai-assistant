export type EmbeddingVector = number[];

export interface VectorMetadata {
  name: string;
  pageOrSection: string;
  text: string;
}

export interface DocumentChunk {
  embedding: EmbeddingVector;
  metadata: VectorMetadata;
}

export interface ScoredResult {
  score: number;
  metadata: VectorMetadata;
}

/**
 * Simple in-memory vector store for document chunks.
 * Designed for deterministic, server-side similarity search over embeddings.
 */
export class InMemoryVectorStore {
  private readonly items: DocumentChunk[] = [];

  /**
   * Add one or more pre-embedded document chunks to the store.
   */
  addDocuments(chunks: DocumentChunk[]): void {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return;
    }

    for (const chunk of chunks) {
      if (!Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
        // Skip invalid or empty embeddings to keep store consistent.
        // In production, consider logging this event.
        continue;
      }
      this.items.push(chunk);
    }
  }

  /**
   * Perform cosine similarity search against stored embeddings.
   *
   * @param queryEmbedding - The query embedding vector.
   * @param topK - Maximum number of results to return (defaults to 5).
   */
  similaritySearch(
    queryEmbedding: EmbeddingVector,
    topK: number = 5,
  ): ScoredResult[] {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return [];
    }

    const normalizedQuery = this.normalize(queryEmbedding);
    if (!normalizedQuery) {
      return [];
    }

    const scored: ScoredResult[] = [];

    for (const item of this.items) {
      const normalizedEmbedding = this.normalize(item.embedding);
      if (!normalizedEmbedding) {
        continue;
      }

      const score = this.cosineSimilarityNormalized(
        normalizedQuery,
        normalizedEmbedding,
      );

      scored.push({ score, metadata: item.metadata });
    }

    scored.sort((a, b) => b.score - a.score);

    if (topK <= 0 || topK >= scored.length) {
      return scored;
    }

    return scored.slice(0, topK);
  }

  private normalize(vector: EmbeddingVector): EmbeddingVector | null {
    let norm = 0;
    for (const value of vector) {
      norm += value * value;
    }

    if (norm === 0) {
      return null;
    }

    const magnitude = Math.sqrt(norm);
    return vector.map((value) => value / magnitude);
  }

  /**
   * Compute cosine similarity for already L2-normalized vectors.
   */
  private cosineSimilarityNormalized(
    a: EmbeddingVector,
    b: EmbeddingVector,
  ): number {
    const length = Math.min(a.length, b.length);
    let dot = 0;

    for (let i = 0; i < length; i += 1) {
      dot += a[i] * b[i];
    }

    return dot;
  }
}


