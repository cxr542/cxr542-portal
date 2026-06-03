import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vercel: VERCEL_ENV = production | preview | development */
const portalBuildEnv = process.env.VERCEL_ENV || 'development'

/** AI-Synapse Wiki `npm run dev` (포털 5173과 분리 → 기본 5174, Windows는 localhost 권장) */
const wikiDevApiUrl = process.env.WIKI_DEV_API_URL || 'http://localhost:5174'

/** public/idea-bank, marathon-log — trailing slash → index.html (Vercel rewrite와 동일) */
const PORTAL_STATIC_APPS = [
  'idea-bank',
  'prompt-collection',
  'how-many-points',
  'who-are-you',
  'marathon-log',
  'vision-font',
  'today-shoes',
  'ai-synapse-wiki',
  'gemini-tuner',
]

/** SPA fallback: /app/topics 등 → index.html (정적 에셋 경로 제외) */
function isStaticAppDocumentPath(pathname, app) {
  if (pathname === `/${app}` || pathname === `/${app}/`) return true
  if (!pathname.startsWith(`/${app}/`)) return false
  const leaf = pathname.split('/').pop() || ''
  return !leaf.includes('.')
}

function portalStaticAppsPlugin() {
  const rewrite = (req) => {
    const raw = req.url || ''
    const [pathname, search = ''] = raw.split('?')
    for (const app of PORTAL_STATIC_APPS) {
      if (isStaticAppDocumentPath(pathname, app)) {
        req.url = `/${app}/index.html${search ? `?${search}` : ''}`
        return
      }
    }
  }

  const middleware = (req, _res, next) => {
    rewrite(req)
    next()
  }

  return {
    name: 'portal-static-apps',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), portalStaticAppsPlugin()],
  define: {
    __PORTAL_BUILD_ENV__: JSON.stringify(portalBuildEnv),
  },
  server:
    command === 'serve'
      ? {
          port: Number(process.env.PORTAL_DEV_PORT) || 5173,
          strictPort: false,
          host: 'localhost',
          proxy: {
            '/api/admin': {
              target: wikiDevApiUrl,
              changeOrigin: true,
            },
          },
        }
      : undefined,
}))
