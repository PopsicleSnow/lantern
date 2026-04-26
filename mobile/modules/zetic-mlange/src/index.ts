import { requireNativeModule } from 'expo-modules-core';

export type DType = 'int32' | 'int64' | 'float32';
export type ModelMode = 'AUTO' | 'SPEED' | 'ACCURACY';

export interface JSTensor {
  shape: number[];
  dtype: DType;
  /** Raw little-endian bytes for this tensor. */
  data: Uint8Array;
}

interface NativeTensor {
  shape: number[];
  dtype: DType;
  /** Base64-encoded little-endian bytes. */
  data: string;
}

interface ZeticMlangeNative {
  loadModel(
    personalKey: string,
    modelName: string,
    version: number | null,
    modelMode: ModelMode
  ): Promise<string>;
  runModel(handle: string, inputs: NativeTensor[]): Promise<NativeTensor[]>;
  releaseModel(handle: string): Promise<boolean>;
}

const native = requireNativeModule<ZeticMlangeNative>('ZeticMlangeModule');

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return globalThis.btoa
    ? globalThis.btoa(binary)
    : Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (globalThis.atob) {
    const bin = globalThis.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export async function loadModel(
  personalKey: string,
  modelName: string,
  version: number | null = null,
  modelMode: ModelMode = 'AUTO'
): Promise<string> {
  return native.loadModel(personalKey, modelName, version, modelMode);
}

export async function run(
  handle: string,
  inputs: JSTensor[]
): Promise<JSTensor[]> {
  const native_inputs: NativeTensor[] = inputs.map((t) => ({
    shape: t.shape,
    dtype: t.dtype,
    data: bytesToBase64(t.data),
  }));
  const native_outputs = await native.runModel(handle, native_inputs);
  return native_outputs.map((t) => ({
    shape: t.shape,
    dtype: t.dtype,
    data: base64ToBytes(t.data),
  }));
}

export async function releaseModel(handle: string): Promise<boolean> {
  return native.releaseModel(handle);
}

export default { loadModel, run, releaseModel };
