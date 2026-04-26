import mongoose, { Schema, Document } from 'mongoose';

export interface IJournalist extends Document {
  name: string;
  organization: string;
  beats: string[];
  email_hash: string;
  email_encrypted: string;
  securedrop_url?: string;
  public_key?: string;
  public_key_fingerprint?: string;
  key_uploaded_at?: Date;
  verified: boolean;
  active: boolean;
  tip_count: number;
}

const JournalistSchema = new Schema<IJournalist>({
  name: { type: String, required: true },
  organization: { type: String, required: true },
  beats: [{ type: String }],
  email_hash: { type: String, required: true },
  email_encrypted: { type: String, required: true },
  securedrop_url: { type: String },
  public_key: { type: String },
  public_key_fingerprint: { type: String },
  key_uploaded_at: { type: Date },
  verified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  tip_count: { type: Number, default: 0 },
});

export default (mongoose.models.Journalist as mongoose.Model<IJournalist>) ||
  mongoose.model<IJournalist>('Journalist', JournalistSchema);
