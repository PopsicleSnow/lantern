# Lantern Mobile (Phase 3)

React Native (Expo) app that mirrors the web tipper flow but runs on-device classification through **ZETIC.MLange** instead of `@xenova/transformers`. Same backend, same `ITipMetadata` contract.

## Architecture

```
write → World ID (optional) → tokenize (cased WordPiece)
       → ZeticMLangeModel.run × (7 labels + 1 text)  ← on-device
       → mean-pool embeddings → cosine similarity → softmax → category, confidence, beats
       → quality heuristics (+ embedding norm) → ITipMetadata
       → POST /api/tips/metadata → encryptToRecipient (tweetnacl box)
       → POST /api/tips/{id}/ciphertext
```

Cleartext never leaves the device. The native module is a thin wrapper around `com.zeticai.mlange:mlange:1.6.1` (Android) and the `ZeticMLangeiOS` Swift package 1.6.0 (iOS) — see `modules/zetic-mlange/`.

## Why embedding similarity instead of zero-shot NLI

The web app uses `Xenova/distilbert-base-uncased-mnli` and runs HuggingFace's zero-shot pipeline (which softmaxes per-label entailment logits from an MNLI head). On mobile we use `Steve/distilbert-base-multilingual-cased` because that's already converted on the Mlange dashboard — but it's a base encoder with **no MNLI head**.

So the mobile pipeline:
1. Encodes the tip text into a 768-dim mean-pooled embedding
2. Encodes each beat label the same way (cached after first run)
3. Cosine similarity between text and each label
4. Tempered softmax → confidence distribution

Result is the same `EdgeClassification` shape; semantics are similar (label most semantically aligned wins) but not identical to MNLI zero-shot. Confidence values are softmaxed with a small temperature (`0.05`) because raw cosines on a base model cluster tightly.

## One-time setup

### 1. ZETIC dashboard

The model `Steve/distilbert-base-multilingual-cased` (version 2) is already in the Mlange catalog. You only need a personal key from https://mlange.zetic.ai. Drop it into `app.json`:

```json
"EXPO_PUBLIC_ZETIC_PERSONAL_KEY": "dev_..."
```

### 2. Vocab

`assets/distilbert-vocab.txt` should be the cased multilingual vocab from HuggingFace:

```bash
curl -L -o mobile/assets/distilbert-vocab.txt \
  https://huggingface.co/distilbert-base-multilingual-cased/resolve/main/vocab.txt
```

### 3. API base

`EXPO_PUBLIC_API_BASE` in `app.json` points the app at the running Next.js server.

| Target | Value |
|---|---|
| Android emulator → host | `http://10.0.2.2:3000` |
| iOS simulator → host | `http://localhost:3000` |
| Physical device on LAN | `http://<your-LAN-ip>:3000` |

### 4. Install + prebuild

```bash
cd mobile
npm install
npx expo prebuild --clean
```

### 5. Add ZETIC iOS package (iOS only)

ZETIC.MLange iOS is distributed via Swift Package Manager only.

```bash
open ios/Lantern.xcworkspace
```

Then in Xcode:
1. **File → Add Package Dependencies**
2. URL: `https://github.com/zetic-ai/ZeticMLangeiOS.git`
3. **Dependency Rule → Exact Version → 1.6.0**
4. Add to target **Lantern** (and the Pods target if prompted)

> Re-running `expo prebuild --clean` regenerates `ios/`, so you'll need to re-add the SPM package. A future improvement is a config plugin that wires this automatically.

### 6. Run

```bash
npx expo run:android    # builds + installs the dev client
npx expo run:ios        # iOS — requires CocoaPods + Xcode
```

The Next.js server should be running in another terminal (`cd .. && npm run dev`).

## World ID on mobile

Uses `@worldcoin/idkit-react-native`. `components/WorldIDButton.tsx` falls back gracefully if the package isn't resolvable — the **Skip verification** path always works for end-to-end demos. The same `/api/worldid/rp-context` and `/api/worldid/verify` endpoints from the web app are reused.

## Key files

| Path | Purpose |
|---|---|
| `app/index.tsx` | Submission screen state machine (writing/verifying/analyzing/encrypting/submitting/confirmed/error) |
| `lib/edge-ai/classify.ts` | Encodes text + beat labels through ZETIC, cosine-similarity classification, returns embedding for reuse |
| `lib/edge-ai/quality.ts` | Heuristic quality + embedding-norm contribution (web parity weights when embedding present) |
| `lib/edge-ai/tokenizer.ts` | Pure-TS WordPiece (BertTokenizer-compatible, cased + accents preserved for multilingual) |
| `lib/edge-ai/runtime.ts` | Vocab loader + ZETIC handle cache + config readers |
| `lib/crypto/keypair.ts` | tweetnacl box helpers — copied verbatim from `/lib/crypto/keypair.ts` |
| `lib/api.ts` | Typed wrappers around `/api/tips/metadata`, `/api/tips/:id/ciphertext`, World ID routes |
| `modules/zetic-mlange/` | Custom Expo native module (Kotlin + Swift) wrapping `ZeticMLangeModel` (SDK 1.6.x) |

## Native module surface

JS calls into the module with structured tensors:

```ts
loadModel(personalKey, modelName, version?, modelMode?): Promise<handle>
run(handle, inputs: { shape, dtype, data: Uint8Array }[]): Promise<{ shape, dtype, data: Uint8Array }[]>
```

Inputs are shipped as base64-encoded little-endian bytes; the native side reconstructs `Tensor` objects from `(data, shape, dataType)`. The exact `Tensor` constructor on the SDK may vary between minors — if the build fails on `Tensor(buffer, shape, dataType)` (Android) or `Tensor(data:shape:dataType:)` (iOS), update the `buildTensor`/`extractTensor` helpers in the native module to match the actual SDK API.

## Dtype assumption

`classify.ts` packs `input_ids` and `attention_mask` as little-endian **int64** (matches standard ONNX BERT export). If your converted model expects **int32** instead, change `int32ToInt64Bytes` to a 4-byte writer and the JSTensor `dtype` from `'int64'` to `'int32'`.

## Output shape assumption

`classify.ts` expects the model output to be `[1, seq_len, 768]` (raw `last_hidden_state`) and applies mean-pooling in JS. If your converted model returns a pooled `[1, 768]` tensor instead, the code detects this and uses it directly. Other shapes throw with a descriptive error.

## Verification

- **Tokenizer parity:** `tokenizer.tokenize("The CFO embezzled $2.4 million in Q3 2024.")` should match `transformers.AutoTokenizer.from_pretrained("distilbert-base-multilingual-cased")(...)` from Python (cased, no accent stripping).
- **Classifier sanity:** classify "The CFO embezzled millions through shell companies in 2023." — top label should be `financial fraud` with confidence > 0.4 after the temperature-scaled softmax.
- **End-to-end:** run `npm run dev` at the repo root, run `npx expo run:android` here, submit a tip, and inspect with `mongosh`:
  ```js
  db.tips.find().sort({_id:-1}).limit(1).pretty()
  // expect: status: 'routed', classification_source: 'edge_ai',
  //         ciphertexts: [{ journalist_id, ciphertext, nonce, ephemeral_pubkey }]
  ```
- **No cleartext leak:** Android Studio → Profiler → Network. Body of `/api/tips/metadata` must contain only `{ metadata, idkit_response? }`. No field named `content`.

## Troubleshooting

- **`requireNativeModule('ZeticMlangeModule')` throws** — you didn't run `expo prebuild` after adding the module, or the plugin isn't listed in `app.json`. Re-run `npx expo prebuild --clean`.
- **`Vocab missing required special token: [CLS]`** — `assets/distilbert-vocab.txt` is the placeholder. Download the real `vocab.txt` (see step 2).
- **`Unexpected output shape […]`** — your converted model's output isn't `[1, seq_len, 768]` or `[1, 768]`. Check the export.
- **iOS build fails on `import ZeticMLange`** — the SPM package wasn't added (step 5).
- **Network errors connecting to localhost** — Android emulators see the host as `10.0.2.2`, not `localhost`/`127.0.0.1`.
- **Confidence values are all ~0.14 (uniform)** — base BERT cosine similarities cluster tightly. The temperature in `classify.ts` (`softmax(sims, 0.05)`) sharpens them; lower the value (e.g. `0.02`) for sharper peaks if needed.
