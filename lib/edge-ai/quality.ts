'use client';

import { configureTransformers, preferredDevice } from './runtime';
import type { EdgeClassification } from './classify';
import type { ITipMetadata } from '@/lib/models/Tip';

type ProgressEvent = { status: string; name?: string; progress?: number; loaded?: number; total?: number };
type Embedder = (text: string, options?: Record<string, unknown>) => Promise<{ data: ArrayLike<number> }>;

let embedderPromise: Promise<Embedder> | null = null;

async function buildEmbedder(onProgress?: (e: ProgressEvent) => void): Promise<Embedder> {
  await configureTransformers();
  const device = await preferredDevice();
  const { pipeline } = await import('@xenova/transformers');
  return (await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    {
      progress_callback: onProgress,
      device,
    } as Record<string, unknown>
  )) as unknown as Embedder;
}

export async function getEmbedder(
  onProgress?: (e: ProgressEvent) => void
): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = buildEmbedder(onProgress);
  }
  return embedderPromise;
}

const DATE_PATTERNS = [
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?\b/gi,
  /\b(?:19|20)\d{2}\b/g,
];

const MONEY_PATTERNS = [
  /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand|k|m|b))?/gi,
  /\b\d+(?:\.\d+)?\s*(?:million|billion|thousand)\s+(?:dollars|usd|eur|euros|pounds|gbp)\b/gi,
];

const ENTITY_PATTERN = /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

function detectDates(text: string): number {
  let count = 0;
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function detectMoney(text: string): number {
  let count = 0;
  for (const pattern of MONEY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

function detectEntities(text: string): number {
  const lines = text.replace(/[.!?]\s+/g, '\n').split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tail = trimmed.replace(/^([A-Z]\w*)\s/, '');
    const matches = tail.match(ENTITY_PATTERN);
    if (matches) count += matches.length;
  }
  return count;
}

function lexicalDiversity(words: string[]): number {
  if (words.length === 0) return 0;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  return unique.size / words.length;
}

function vectorNorm(values: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v * v;
  }
  return Math.sqrt(sum);
}

export async function computeMetadata(
  text: string,
  classification: EdgeClassification,
  onProgress?: (e: ProgressEvent) => void
): Promise<ITipMetadata> {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);

  const date_count = detectDates(trimmed);
  const money_mentions = detectMoney(trimmed);
  const entity_count = detectEntities(trimmed);

  const has_dates = date_count > 0;
  const has_entities = entity_count > 0;
  const has_specifics = has_dates || has_entities || money_mentions > 0;

  const embedder = await getEmbedder(onProgress);
  const output = await embedder(trimmed.slice(0, 2000), { pooling: 'mean', normalize: false });
  const norm = vectorNorm(output.data);

  const length_score = Math.min(1, words.length / 200);
  const diversity_score = lexicalDiversity(words);
  const sentence_score = Math.min(1, sentences.length / 8);
  const specificity_score =
    (has_dates ? 0.34 : 0) + (has_entities ? 0.33 : 0) + (money_mentions > 0 ? 0.33 : 0);
  const norm_score = Math.min(1, norm / 12);

  const structural_quality =
    0.25 * length_score +
    0.20 * diversity_score +
    0.20 * sentence_score +
    0.20 * specificity_score +
    0.15 * norm_score;

  let urgency: 'low' | 'medium' | 'high' = 'medium';
  if (classification.confidence < 0.4 && structural_quality < 0.4) urgency = 'low';
  else if (classification.confidence > 0.75 && (has_dates || money_mentions > 0)) urgency = 'high';

  return {
    category: classification.category,
    confidence: classification.confidence,
    beats: classification.beats,
    urgency,
    word_count: words.length,
    char_count: trimmed.length,
    has_entities,
    has_dates,
    has_specifics,
    structural_quality: Math.round(structural_quality * 100) / 100,
    entity_count,
    date_count,
    money_mentions,
  };
}
