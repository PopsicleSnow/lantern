import mongoose, { Schema, Document } from 'mongoose';

export interface ICiphertextEntry {
  journalist_id: string;
  ciphertext: string;
  nonce: string;
  ephemeral_pubkey: string;
}

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

export interface ITip extends Document {
  nullifier_hash: string;
  metadata: ITipMetadata;
  preferences?: ITipPreferences;
  ciphertexts: ICiphertextEntry[];
  verified_human: boolean;
  priority: 'high' | 'standard';
  status: 'awaiting_ciphertext' | 'pending' | 'routed' | 'human_review' | 'closed';
  category: string;
  category_confidence: number;
  classification_source: 'edge_ai' | 'asi1_meta' | 'manual';
  assigned_journalist_id?: string;
  beats_matched: string[];
  urgency: 'low' | 'medium' | 'high';
  read_at?: Date;
  read_by_journalist_id?: string;
  credibility_at_submission?: number;
  bounty_claimed: boolean;
  bounty_tx_sig?: string;
  bounty_recipient?: string;
  bounty_amount_lamports?: string;
  bounty_claimed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const CiphertextEntrySchema = new Schema<ICiphertextEntry>(
  {
    journalist_id: { type: String, required: true },
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
    ephemeral_pubkey: { type: String, required: true },
  },
  { _id: false }
);

const TipMetadataSchema = new Schema<ITipMetadata>(
  {
    category: { type: String, required: true },
    confidence: { type: Number, required: true },
    beats: [{ type: String }],
    urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    word_count: { type: Number, default: 0 },
    char_count: { type: Number, default: 0 },
    has_entities: { type: Boolean, default: false },
    has_dates: { type: Boolean, default: false },
    has_specifics: { type: Boolean, default: false },
    structural_quality: { type: Number, default: 0 },
    entity_count: { type: Number, default: 0 },
    date_count: { type: Number, default: 0 },
    money_mentions: { type: Number, default: 0 },
  },
  { _id: false }
);

const TipPreferencesSchema = new Schema<ITipPreferences>(
  {
    category: { type: String },
    organization: { type: String },
    journalist_id: { type: String },
  },
  { _id: false }
);

const TipSchema = new Schema<ITip>({
  nullifier_hash: { type: String, required: true, index: true },
  metadata: { type: TipMetadataSchema, required: true },
  preferences: { type: TipPreferencesSchema },
  ciphertexts: { type: [CiphertextEntrySchema], default: [] },
  verified_human: { type: Boolean, default: false },
  priority: { type: String, enum: ['high', 'standard'], default: 'standard' },
  status: {
    type: String,
    enum: ['awaiting_ciphertext', 'pending', 'routed', 'human_review', 'closed'],
    default: 'awaiting_ciphertext',
  },
  category: { type: String, default: 'uncategorized' },
  category_confidence: { type: Number, default: 0 },
  classification_source: {
    type: String,
    enum: ['edge_ai', 'asi1_meta', 'manual'],
    default: 'edge_ai',
  },
  assigned_journalist_id: { type: String },
  beats_matched: [{ type: String }],
  urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  read_at: { type: Date },
  read_by_journalist_id: { type: String },
  credibility_at_submission: { type: Number },
  bounty_claimed: { type: Boolean, default: false },
  bounty_tx_sig: { type: String, default: null },
  bounty_recipient: { type: String, default: null },
  bounty_amount_lamports: { type: String, default: null },
  bounty_claimed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default (mongoose.models.Tip as mongoose.Model<ITip>) ||
  mongoose.model<ITip>('Tip', TipSchema);
