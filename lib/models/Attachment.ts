import mongoose, { Schema, Document } from 'mongoose';

export interface IWrappedKey {
  journalist_id: string;
  key_ciphertext: string;
  key_nonce: string;
  ephemeral_pubkey: string;
}

export interface IAttachment extends Document {
  tip_id: string;
  file_ciphertext: Buffer;
  file_nonce: string;
  filename_ciphertext: string;
  filename_nonce: string;
  mime_type: string;
  file_size: number;
  wrapped_keys: IWrappedKey[];
  created_at: Date;
}

const WrappedKeySchema = new Schema<IWrappedKey>(
  {
    journalist_id: { type: String, required: true },
    key_ciphertext: { type: String, required: true },
    key_nonce: { type: String, required: true },
    ephemeral_pubkey: { type: String, required: true },
  },
  { _id: false }
);

const AttachmentSchema = new Schema<IAttachment>({
  tip_id: { type: String, required: true, index: true },
  file_ciphertext: { type: Buffer, required: true },
  file_nonce: { type: String, required: true },
  filename_ciphertext: { type: String, required: true },
  filename_nonce: { type: String, required: true },
  mime_type: { type: String, default: 'application/octet-stream' },
  file_size: { type: Number, required: true },
  wrapped_keys: { type: [WrappedKeySchema], default: [] },
  created_at: { type: Date, default: Date.now },
});

export default (mongoose.models.Attachment as mongoose.Model<IAttachment>) ||
  mongoose.model<IAttachment>('Attachment', AttachmentSchema);
