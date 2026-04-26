import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...(config.resolve?.fallback ?? {}),
          fs: false,
          path: false,
          url: false,
          crypto: false,
          stream: false,
          buffer: false,
        },
      };
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };
    }
    return config;
  },
};

export default nextConfig;
