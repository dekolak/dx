/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the Coolify/Docker image small (only the traced deps).
  output: "standalone",
  images: {
    // Media is served from OVH Object Storage (S3-compatible). The exact host is
    // configured per environment, so we allow any https remote pattern and rely on
    // the storage bucket policy for real access control.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
