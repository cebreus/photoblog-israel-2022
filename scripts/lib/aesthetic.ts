/**
 * Compute cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Calculate the aesthetic score for an embedding by projecting it on the aesthetic axis.
 */
export function calculateAestheticScore(embedding: number[], aestheticAxis: number[]): number {
  return cosineSimilarity(embedding, aestheticAxis);
}

/**
 * Normalizes a raw aesthetic score (cosine similarity, typically -0.1 to 0.1) to 0-100 range.
 */
export function normalizeAestheticScore(score: number): number {
  // Typical CLIP cosine similarity for aesthetic scores ranges from -0.1 to 0.1.
  // We map -0.1 to 0, 0 to 50, and 0.1 to 100.
  const normalized = (score + 0.1) * 500;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Create a normalized aesthetic axis from a positive and negative prompt embedding.
 */
export function createAestheticAxis(posEmbedding: number[], negEmbedding: number[]): number[] {
  if (posEmbedding.length !== negEmbedding.length) {
    throw new Error("Embedding length mismatch for axis creation");
  }

  const axis = new Array(posEmbedding.length).fill(0);
  let norm = 0;

  for (let i = 0; i < posEmbedding.length; i++) {
    axis[i] = posEmbedding[i] - negEmbedding[i];
    norm += axis[i] * axis[i];
  }

  norm = Math.sqrt(norm);

  for (let i = 0; i < axis.length; i++) {
    axis[i] /= norm;
  }

  return axis;
}
