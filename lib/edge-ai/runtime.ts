'use client';

let configured = false;

export async function configureTransformers() {
  if (configured) return;
  const { env } = await import('@xenova/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  // Point onnxruntime-web at the statically-served WASM files so they're
  // found regardless of how the JS chunk is named/located after bundling.
  env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';
  configured = true;
}

export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await (gpu as { requestAdapter: () => Promise<unknown> }).requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export async function preferredDevice(): Promise<'webgpu' | 'wasm'> {
  return (await isWebGPUAvailable()) ? 'webgpu' : 'wasm';
}
