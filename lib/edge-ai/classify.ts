'use client';

import { configureTransformers, preferredDevice } from './runtime';

export const BEAT_LABELS = [
  'financial fraud',
  'environmental misconduct',
  'government corruption',
  'corporate misconduct',
  'health and safety',
  'national security',
  'tech and platforms',
] as const;

const BEAT_TO_KEY: Record<string, string> = {
  'financial fraud': 'financial_fraud',
  'environmental misconduct': 'environmental',
  'government corruption': 'government',
  'corporate misconduct': 'corporate',
  'health and safety': 'health',
  'national security': 'national_security',
  'tech and platforms': 'tech',
};

const CATEGORY_FROM_BEAT: Record<string, string> = {
  financial_fraud: 'financial_fraud',
  environmental: 'environmental',
  government: 'government_corruption',
  corporate: 'corporate_misconduct',
  health: 'health_safety',
  national_security: 'government_corruption',
  tech: 'corporate_misconduct',
};

type ProgressEvent = { status: string; name?: string; progress?: number; loaded?: number; total?: number };
type Pipeline = (text: string, labels: string[], options?: Record<string, unknown>) => Promise<unknown>;

let classifierPromise: Promise<Pipeline> | null = null;

async function buildClassifier(onProgress?: (e: ProgressEvent) => void): Promise<Pipeline> {
  await configureTransformers();
  const device = await preferredDevice();
  const { pipeline } = await import('@xenova/transformers');
  return (await pipeline(
    'zero-shot-classification',
    'Xenova/distilbert-base-uncased-mnli',
    {
      progress_callback: onProgress,
      device,
    } as Record<string, unknown>
  )) as unknown as Pipeline;
}

export async function getClassifier(
  onProgress?: (e: ProgressEvent) => void
): Promise<Pipeline> {
  if (!classifierPromise) {
    classifierPromise = buildClassifier(onProgress);
  }
  return classifierPromise;
}

export interface EdgeClassification {
  category: string;
  confidence: number;
  beats: string[];
  raw_scores: Array<{ label: string; score: number }>;
}

export async function classify(
  text: string,
  onProgress?: (e: ProgressEvent) => void
): Promise<EdgeClassification> {
  const classifier = await getClassifier(onProgress);
  const result = (await classifier(text, [...BEAT_LABELS], { multi_label: false })) as
    | { labels: string[]; scores: number[] }
    | Array<{ labels: string[]; scores: number[] }>;
  const single = Array.isArray(result) ? result[0] : result;
  const labels = single.labels;
  const scores = single.scores;

  const top_label = labels[0];
  const confidence = scores[0];
  const beat_key = BEAT_TO_KEY[top_label] ?? 'general';
  const category = CATEGORY_FROM_BEAT[beat_key] ?? 'other';

  const beats = labels
    .map((l, i) => ({ key: BEAT_TO_KEY[l] ?? 'general', score: scores[i] }))
    .filter((b) => b.score >= 0.2)
    .map((b) => b.key);

  return {
    category,
    confidence,
    beats: beats.length > 0 ? beats : [beat_key],
    raw_scores: labels.map((l, i) => ({ label: l, score: scores[i] })),
  };
}
