import { classify } from './classify';
import { computeMetadata } from './quality';
import type { ITipMetadata } from '@/lib/types';

type ProgressEvent = { status: string; name?: string; progress?: number };

export async function runEdgeAI(
  text: string,
  onProgress?: (e: ProgressEvent) => void
): Promise<ITipMetadata> {
  const { classification, embedding } = await classify(text, onProgress);
  return computeMetadata(text, classification, embedding);
}

export { classify, computeMetadata };
