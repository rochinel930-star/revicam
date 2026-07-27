import type { NextConfig } from "next";

// ── Sécurité — Phase P1 (durcissement de la plateforme) ──────────────
// En-têtes de sécurité appliqués à toutes les routes.
//
// La CSP est compatible avec le moteur de rendu scientifique : la sortie
// KaTeX est du MathML pur (aucune webfont, aucun style inline requis), et
// les SVG éditoriaux sont assainis (rehype-sanitize). Points de vigilance :
//   - `style-src 'unsafe-inline'` : Tailwind v4 / Next injectent des styles.
//   - `script-src 'unsafe-inline'` : bootstrap d'hydratation Next.
//   - `'unsafe-eval'` : uniquement en développement (Turbopack/HMR).
//   - `connect-src` autorise Supabase (lectures anon éventuelles côté client).
//   - `frame-ancestors 'none'` + X-Frame-Options : anti-clickjacking.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self' https://*.supabase.co",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
