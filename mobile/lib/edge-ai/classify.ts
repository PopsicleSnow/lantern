import { run as nativeRun, type JSTensor } from '@/modules/zetic-mlange/src';
import { getModelHandle, getTokenizer } from './runtime';

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

export interface EdgeClassification {
  category: string;
  confidence: number;
  beats: string[];
  raw_scores: Array<{ label: string; score: number }>;
}

export interface ClassifyResult {
  classification: EdgeClassification;
  /** Mean-pooled text embedding — reused by quality.ts for the structural-quality norm. */
  embedding: Float32Array;
}

const HIDDEN_DIM = 768; // distilbert-base-multilingual-cased
const MAX_LEN = 256; // bounded for mobile latency

// distilbert ONNX exports use int64 input_ids/attention_mask. Pack Int32 → little-endian int64.
function int32ToInt64Bytes(arr: Int32Array): Uint8Array {
  const out = new Uint8Array(arr.length * 8);
  const view = new DataView(out.buffer);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    view.setInt32(i * 8, v, true);
    view.setInt32(i * 8 + 4, v < 0 ? -1 : 0, true);
  }
  return out;
}

function bytesToFloat32(buf: Uint8Array): Float32Array {
  const aligned = new Uint8Array(buf);
  return new Float32Array(aligned.buffer, aligned.byteOffset, buf.length / 4);
}

function meanPool(
  hidden: Float32Array,
  attentionMask: Int32Array,
  hiddenDim: number
): Float32Array {
  const seqLen = attentionMask.length;
  const out = new Float32Array(hiddenDim);
  let count = 0;
  for (let j = 0; j < seqLen; j++) {
    if (attentionMask[j] === 0) continue;
    count++;
    const off = j * hiddenDim;
    for (let i = 0; i < hiddenDim; i++) out[i] += hidden[off + i];
  }
  if (count > 0) for (let i = 0; i < hiddenDim; i++) out[i] /= count;
  return out;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

function softmax(values: number[], temperature = 1.0): number[] {
  const scaled = values.map((v) => v / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

async function encodeText(text: string): Promise<Float32Array> {
  const tokenizer = await getTokenizer();
  const handle = await getModelHandle();
  const { input_ids, attention_mask } = tokenizer.encodeSingle(text, MAX_LEN);
  const seqLen = input_ids.length;

  const inputs: JSTensor[] = [
    { shape: [1, seqLen], dtype: 'int64', data: int32ToInt64Bytes(input_ids) },
    { shape: [1, seqLen], dtype: 'int64', data: int32ToInt64Bytes(attention_mask) },
  ];

  const outputs = await nativeRun(handle, inputs);
  if (outputs.length === 0) {
    throw new Error('ZETIC model returned no outputs');
  }

  const out = outputs[0];
  // Expected shape: [1, seqLen, hidden_dim] (last_hidden_state). If the converted model
  // already pools to [1, hidden_dim], skip pooling.
  const hidden = bytesToFloat32(out.data);
  if (out.shape.length === 2 && out.shape[1] === HIDDEN_DIM) {
    return hidden.slice();
  }
  if (out.shape.length === 3 && out.shape[2] === HIDDEN_DIM) {
    return meanPool(hidden, attention_mask, HIDDEN_DIM);
  }
  throw new Error(
    `Unexpected output shape [${out.shape.join(',')}] — expected [1, seq_len, ${HIDDEN_DIM}] or [1, ${HIDDEN_DIM}]`
  );
}

let labelEmbeddingsPromise: Promise<Float32Array[]> | null = null;

async function ensureLabelEmbeddings(
  onProgress?: (e: { status: string; name?: string; progress?: number }) => void
): Promise<Float32Array[]> {
  if (labelEmbeddingsPromise) return labelEmbeddingsPromise;
  labelEmbeddingsPromise = (async () => {
    const out: Float32Array[] = [];
    for (let i = 0; i < BEAT_LABELS.length; i++) {
      onProgress?.({
        status: 'progress',
        name: `label: ${BEAT_LABELS[i]}`,
        progress: (i / (BEAT_LABELS.length + 1)) * 100,
      });
      out.push(await encodeText(BEAT_LABELS[i]));
    }
    return out;
  })();
  return labelEmbeddingsPromise;
}

export async function classify(
  text: string,
  onProgress?: (e: { status: string; name?: string; progress?: number }) => void
): Promise<ClassifyResult> {
  const labels = await ensureLabelEmbeddings(onProgress);

  onProgress?.({ status: 'progress', name: 'tip', progress: 90 });
  const textEmbedding = await encodeText(text);
  onProgress?.({ status: 'ready', progress: 100 });

  const sims = labels.map((l) => cosine(textEmbedding, l));
  // Cosine values cluster tightly; temperature scales the softmax to give meaningful confidences.
  const scores = softmax(sims, 0.05);

  const ordered = BEAT_LABELS
    .map((label, i) => ({ label, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  const top_label = ordered[0].label;
  const confidence = ordered[0].score;
  const beat_key = BEAT_TO_KEY[top_label] ?? 'general';
  const category = CATEGORY_FROM_BEAT[beat_key] ?? 'other';

  const beats = ordered
    .map((b) => ({ key: BEAT_TO_KEY[b.label] ?? 'general', score: b.score }))
    .filter((b) => b.score >= 0.2)
    .map((b) => b.key);

  return {
    classification: {
      category,
      confidence,
      beats: beats.length > 0 ? beats : [beat_key],
      raw_scores: ordered.map((b) => ({ label: b.label, score: b.score })),
    },
    embedding: textEmbedding,
  };
}
