import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
};

export default nextConfig;
