import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * SPEC §14 P4 / T28: CSP without nonces. Nonces require fully dynamic rendering,
 * which conflicts with the Partial Prerender static shell (Cache Components), so
 * inline scripts/styles stay allowed; everything else is locked to this origin.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  // No upgrade-insecure-requests: it would break `next start` on http://localhost;
  // HSTS below covers HTTPS on Vercel.
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), fullscreen=(self)",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/", destination: "/events", permanent: false }];
  },
};

export default nextConfig;
