/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the long-running dev server isolated from `next build`. Both commands
  // writing to `.next` at the same time can mix server HTML with stale client
  // chunks and surface as a React hydration mismatch.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
  async redirects() {
    return [
      // BeautyDocs route promotion (Phase 2) — keep old preview URLs working.
      { source: '/beautydocs-home-preview', destination: '/', permanent: false },
      { source: '/beautydocs-konto-preview', destination: '/konto', permanent: false },
      { source: '/beautydocs-zaproszenie', destination: '/zaproszenie', permanent: false },
      { source: '/beautydocs-platform-preview', destination: '/platforma', permanent: false },
      { source: '/beautydocs-klient-preview', destination: '/klient', permanent: false },
      { source: '/beautydocs-admin-preview/:path*', destination: '/panel/:path*', permanent: false },
      { source: '/beautydocs-forms-preview/:path*', destination: '/f/:path*', permanent: false },
      { source: '/beautydocs-preview/:tenantSlug', destination: '/f/:tenantSlug', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'instagram.com',
      },
      {
        protocol: 'https',
        hostname: 'cdninstagram.com',
      },
    ],
  },
}

module.exports = nextConfig
