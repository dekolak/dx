/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NB : pas de `output: "standalone"`. L'image Docker garde des node_modules
  // complets (pour disposer du CLI Prisma au `migrate deploy` du démarrage) et
  // lance `next start` — les deux sont incompatibles avec le mode standalone.
  // Les médias sont servis en local (/api/media, même origine) → pas besoin de
  // `images.remotePatterns` (on utilise de simples <img>, pas next/image).
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
