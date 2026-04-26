import type { EdgeClassification } from './classify';
import type { ITipMetadata } from '@/lib/types';

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

// Threshold tuned for distilbert-base-multilingual-cased mean-pool norms (~10–30).
// Web app uses 12 for all-MiniLM-L6-v2 — different model, different distribution.
const NORM_THRESHOLD = 25;

export function computeMetadata(
  text: string,
  classification: EdgeClassification,
  textEmbedding?: Float32Array
): ITipMetadata {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);

  const date_count = detectDates(trimmed);
  const money_mentions = detectMoney(trimmed);
  const entity_count = detectEntities(trimmed);

  const has_dates = date_count > 0;
  const has_entities = entity_count > 0;
  const has_specifics = has_dates || has_entities || money_mentions > 0;

  const length_score = Math.min(1, words.length / 200);
  const diversity_score = lexicalDiversity(words);
  const sentence_score = Math.min(1, sentences.length / 8);
  const specificity_score =
    (has_dates ? 0.34 : 0) + (has_entities ? 0.33 : 0) + (money_mentions > 0 ? 0.33 : 0);

  // Web parity weights (0.25/0.20/0.20/0.20/0.15) when embedding is available.
  const norm_score = textEmbedding
    ? Math.min(1, vectorNorm(textEmbedding) / NORM_THRESHOLD)
    : 0;
  const structural_quality = textEmbedding
    ? 0.25 * length_score +
      0.20 * diversity_score +
      0.20 * sentence_score +
      0.20 * specificity_score +
      0.15 * norm_score
    : // No embedding — reweight the four heuristic components to sum to 1.
      0.30 * length_score +
      0.25 * diversity_score +
      0.25 * sentence_score +
      0.20 * specificity_score;

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
