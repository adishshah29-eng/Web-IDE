import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cross-origin isolation, required for WebContainers (SharedArrayBuffer).
  // jsdelivr (Monaco's CDN) already sends Cross-Origin-Resource-Policy, so
  // this shouldn't break the editor — verified after adding this.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
