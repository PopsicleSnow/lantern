// Mirrors /lib/models/Tip.ts — this file MUST stay in sync with the server contract.
// Server validation lives in /app/api/tips/metadata/route.ts (isValidMetadata).

export interface ITipMetadata {
  category: string;
  confidence: number;
  beats: string[];
  urgency: 'low' | 'medium' | 'high';
  word_count: number;
  char_count: number;
  has_entities: boolean;
  has_dates: boolean;
  has_specifics: boolean;
  structural_quality: number;
  entity_count: number;
  date_count: number;
  money_mentions: number;
}

export interface ITipPreferences {
  category?: string;
  organization?: string;
  journalist_id?: string;
}

export interface Recipient {
  journalist_id: string;
  public_key: string;
}

export interface MetadataResponse {
  tip_id: string;
  recipients: Recipient[];
  priority: 'high' | 'standard';
  planned_status: 'awaiting_ciphertext' | 'pending' | 'routed' | 'human_review' | 'closed';
}
