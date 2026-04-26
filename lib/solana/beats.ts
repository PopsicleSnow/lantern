// Beat taxonomy shared between Lantern's edge-AI labels, journalist beats, and
// on-chain BountyPool slugs. The slugs MUST match what the Anchor program uses
// as PDA seeds — keep them lowercase, ASCII, ≤32 bytes.

export const BEAT_SLUGS = [
  'financial_fraud',
  'environmental',
  'government',
  'corporate',
  'national_security',
  'health',
  'tech',
] as const;

export type BeatSlug = (typeof BEAT_SLUGS)[number];

export const BEAT_LABELS: Record<BeatSlug, string> = {
  financial_fraud: 'Financial fraud',
  environmental: 'Environmental misconduct',
  government: 'Government corruption',
  corporate: 'Corporate misconduct',
  national_security: 'National security',
  health: 'Health & safety',
  tech: 'Tech & platforms',
};

// Maps the tip submission form's category values onto on-chain beat slugs.
// Some form categories collapse to the same slug (e.g. "government_corruption" → "government").
const CATEGORY_TO_SLUG: Record<string, BeatSlug> = {
  financial_fraud: 'financial_fraud',
  environmental: 'environmental',
  government_corruption: 'government',
  government: 'government',
  corporate_misconduct: 'corporate',
  corporate: 'corporate',
  health_safety: 'health',
  health: 'health',
  national_security: 'national_security',
  tech: 'tech',
  technology: 'tech',
};

export function isBeatSlug(value: unknown): value is BeatSlug {
  return typeof value === 'string' && (BEAT_SLUGS as readonly string[]).includes(value);
}

// Best-effort mapping. Returns null when no slug matches — callers should treat
// "no slug" as "no bounty available" rather than guessing.
export function categoryToBeatSlug(category: string | null | undefined): BeatSlug | null {
  if (!category) return null;
  const direct = CATEGORY_TO_SLUG[category];
  if (direct) return direct;
  if (isBeatSlug(category)) return category;
  return null;
}

// Pick the best beat slug for a tip given its category + matched beats array.
// Prefer the explicit category, fall back to the first beat that maps cleanly.
export function bestBeatSlugForTip(category: string, beats: string[] = []): BeatSlug | null {
  const fromCategory = categoryToBeatSlug(category);
  if (fromCategory) return fromCategory;
  for (const b of beats) {
    const s = categoryToBeatSlug(b);
    if (s) return s;
  }
  return null;
}
