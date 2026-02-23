import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Mark optional native dependencies as external
  // These are optional deps from just-bash that may not be available in all environments
  serverExternalPackages: ["@mongodb-js/zstd", "node-liblzma"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore optional native dependencies from just-bash
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("@mongodb-js/zstd", "node-liblzma");
      }
    }
    return config;
  },
};

export default nextConfig;
