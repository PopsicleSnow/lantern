import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { loadModel as nativeLoadModel } from '@/modules/zetic-mlange/src';
import { WordPieceTokenizer, parseVocab } from './tokenizer';

let tokenizerPromise: Promise<WordPieceTokenizer> | null = null;
let modelHandlePromise: Promise<string> | null = null;

async function loadVocab(): Promise<WordPieceTokenizer> {
  const asset = Asset.fromModule(require('../../assets/distilbert-vocab.txt'));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  // Multilingual cased BERT: do_lower_case=False, do_strip_accents=False.
  return new WordPieceTokenizer(parseVocab(raw), {
    doLowerCase: false,
    doStripAccents: false,
  });
}

export function getTokenizer(): Promise<WordPieceTokenizer> {
  if (!tokenizerPromise) tokenizerPromise = loadVocab();
  return tokenizerPromise;
}

function readExtra(name: string): string {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (Constants.manifest2 as { extra?: Record<string, unknown> } | undefined)?.extra ??
    {};
  const value = extra[name] ?? process.env[name] ?? '';
  return typeof value === 'string' ? value : String(value);
}

export function getModelHandle(): Promise<string> {
  if (!modelHandlePromise) {
    const personalKey = readExtra('EXPO_PUBLIC_ZETIC_PERSONAL_KEY');
    const modelName = readExtra('EXPO_PUBLIC_ZETIC_MODEL_NAME');
    const versionStr = readExtra('EXPO_PUBLIC_ZETIC_MODEL_VERSION');
    const version = versionStr ? parseInt(versionStr, 10) : null;
    if (!personalKey || !modelName) {
      modelHandlePromise = Promise.reject(
        new Error(
          'ZETIC config missing — set EXPO_PUBLIC_ZETIC_PERSONAL_KEY and EXPO_PUBLIC_ZETIC_MODEL_NAME in app.json extras'
        )
      );
    } else {
      modelHandlePromise = nativeLoadModel(personalKey, modelName, version, 'AUTO');
    }
  }
  return modelHandlePromise;
}

export function getApiBase(): string {
  const base = readExtra('EXPO_PUBLIC_API_BASE');
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_BASE not configured in app.json extras');
  }
  return base.replace(/\/$/, '');
}

export function getWorldIdConfig(): {
  appId: string;
  action: string;
  environment: 'production' | 'staging';
} {
  return {
    appId: readExtra('EXPO_PUBLIC_WLD_APP_ID'),
    action: readExtra('EXPO_PUBLIC_WLD_ACTION'),
    environment:
      (readExtra('EXPO_PUBLIC_WLD_ENVIRONMENT') as 'production' | 'staging') || 'staging',
  };
}
