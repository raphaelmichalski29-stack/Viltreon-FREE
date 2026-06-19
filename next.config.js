const requiredEnvs = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'ENCRYPTION_SALT',
]

for (const env of requiredEnvs) {
  if (!process.env[env]) {
    throw new Error(`Missing required environment variable: ${env}`)
  }
}

// Production-only validations. These catch the configuration mistakes that
// silently degrade security if they reach prod (localhost URLs, weak keys,
// unauthenticated webhooks, missing Redis under cluster mode).
//
// LOCAL_PROD_TEST=1 lets a developer run `npm run prod` locally (production
// build, lower memory than `next dev`) without satisfying the real-deploy
// requirements. The setup-vps.sh script does NOT set this variable, so real
// production still hits every guard.
// `.trim()` defends against the Windows-cmd footgun where
// `set LOCAL_PROD_TEST=1 && ...` sets the value to "1 " (with trailing
// space), causing a strict `=== "1"` comparison to silently fail.
const isLocalProdTest = (process.env.LOCAL_PROD_TEST || '').trim() === '1'
if (process.env.NODE_ENV === 'production' && !isLocalProdTest) {
  const fail = (msg) => { throw new Error(`Production config error: ${msg}`) }

  const nextauthUrl = process.env.NEXTAUTH_URL || ''
  if (!nextauthUrl.startsWith('https://')) {
    fail(`NEXTAUTH_URL must use https in production (got "${nextauthUrl}")`)
  }
  if (/localhost|127\.0\.0\.1/.test(nextauthUrl)) {
    fail(`NEXTAUTH_URL must not point at localhost in production (got "${nextauthUrl}")`)
  }

  if ((process.env.NEXTAUTH_SECRET || '').length < 32) {
    fail('NEXTAUTH_SECRET must be at least 32 characters in production')
  }
  if ((process.env.ENCRYPTION_KEY || '').length < 32) {
    fail('ENCRYPTION_KEY must be at least 32 characters in production')
  }

  if (!process.env.REDIS_URL) {
    fail('REDIS_URL is required in production (memory queue is unsafe under pm2 cluster)')
  }

  // Echo the URL we resolved so a stale ngrok host or wrong .env in prod is
  // immediately visible in the boot log instead of failing mysteriously later
  // (Stripe callbacks 404ing, OAuth state-cookie mismatches, etc.).
  console.log(`[next.config] NEXTAUTH_URL=${nextauthUrl}`)

  // Pub/Sub auth: either OIDC (preferred, CASA tier 3) or the legacy shared token.
  const hasOidc = !!(process.env.PUBSUB_OIDC_AUDIENCE && process.env.PUBSUB_OIDC_SERVICE_ACCOUNT)
  const hasSharedToken = !!process.env.PUBSUB_VERIFICATION_TOKEN
  if (process.env.GOOGLE_PROJECT_ID && process.env.PUBSUB_TOPIC_NAME && !hasOidc && !hasSharedToken) {
    fail('Configure PUBSUB_OIDC_AUDIENCE + PUBSUB_OIDC_SERVICE_ACCOUNT (preferred) or PUBSUB_VERIFICATION_TOKEN — webhook would otherwise accept unauthenticated POSTs')
  }
} else if (isLocalProdTest) {
  console.log('[next.config] LOCAL_PROD_TEST=1 — skipping production-only env validations')
  console.log(`[next.config] NEXTAUTH_URL=${process.env.NEXTAUTH_URL}`)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add your tunnel host here (e.g. an ngrok domain) when testing real-time
  // push from localhost — see docs/REALTIME.md. Empty by default.
  allowedDevOrigins: [],
  poweredByHeader: false,
  // Pin the workspace root to this project so Next doesn't mis-infer it from a
  // stray package-lock.json in a parent/home directory (the "multiple lockfiles"
  // warning self-hosters hit when they clone into their home folder).
  turbopack: { root: __dirname },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force per-icon transform for these barrel-style packages. Without this,
  // every `import { Sun } from "lucide-react"` resolves through the package's
  // index and the bundler often fails to tree-shake the unused icons.
  // Stable Next 16 feature; equivalent to manually writing `import Sun from
  // "lucide-react/dist/esm/icons/sun"` everywhere, but ~12 files cleaner.
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dropdown-menu'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    // Content-Security-Policy is set per-request in src/proxy.ts (middleware) so it
    // can include a per-request script nonce. The non-CSP security headers stay here.
    // HSTS is production-only so local `next start` over plain http://localhost
    // isn't accidentally pinned to https by the browser cache.
    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    if (process.env.NODE_ENV === 'production') {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        // 2 years, include subdomains, eligible for HSTS preload list.
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }
    return [{ source: '/(.*)', headers: baseHeaders }]
  },
}

module.exports = nextConfig
