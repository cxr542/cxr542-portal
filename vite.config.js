import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { promptsDevPlugin } from './server/prompts/dev.mjs'
import portalLogin from './api/portal-login.js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Vercel: VERCEL_ENV = production | preview | development */
const portalBuildEnv = process.env.VERCEL_ENV || 'development'

/** AI-Synapse Wiki `npm run dev` (포털 5173과 분리 → 기본 5174, Windows는 localhost 권장) */
const wikiDevApiUrl = process.env.WIKI_DEV_API_URL || 'http://localhost:5174'

/** public/idea-bank, marathon-log — trailing slash → index.html (Vercel rewrite와 동일) */
const PORTAL_STATIC_APPS = [
  'idea-bank',
  'src-running-ops',
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
      server.middlewares.use((req, _res, next) => {
        if (req.url?.split('?')[0] === '/shared/cloud.css') req.url = '/src/cloud/access.css'
        if (req.url?.split('?')[0] === '/shared/cloud.js') req.url = '/src/cloud/bootstrap.js'
        next()
      })
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

function portalLoginPlugin() {
  const middleware = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/portal-login') return next()
    const reply = {
      setHeader: (name, value) => res.setHeader(name, value),
      status(code) { res.statusCode = code; return this },
      json(value) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) },
    }
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (Buffer.byteLength(raw) > 8192) return reply.status(413).json({ error: 'request_too_large' })
    }
    try { req.body = raw ? JSON.parse(raw) : {} }
    catch { return reply.status(400).json({ error: 'invalid_json' }) }
    await portalLogin(req, reply)
  }
  return {
    name: 'portal-login',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

function runningOpsAuthPlugin() {
  const middleware = async (req, res, next) => {
    if (req.method !== 'POST' || req.url !== '/api/running-ops-auth') {
      next()
      return
    }

    let raw = ''
    for await (const chunk of req) raw += chunk

    try {
      const { role, password } = raw ? JSON.parse(raw) : {}
      const managerPassword = process.env.MANAGER_PASSWORD
      const viewerPassword = process.env.VIEWER_PASSWORD
      const matchedRole =
        role === 'manager' && managerPassword && password === managerPassword
          ? 'manager'
          : role === 'viewer' && viewerPassword && password === viewerPassword
            ? 'viewer'
            : null

      if (!matchedRole) {
        res.statusCode = 401
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'invalid_credentials' }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ role: matchedRole, issuedAt: new Date().toISOString() }))
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'invalid_json' }))
    }
  }

  return {
    name: 'running-ops-auth',
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
  plugins: [react(), promptsDevPlugin(), portalLoginPlugin(), runningOpsAuthPlugin(), portalStaticAppsPlugin()],
  define: {
    __PORTAL_BUILD_ENV__: JSON.stringify(portalBuildEnv),
  },
  build: {
    rollupOptions: {
      output: { assetFileNames: asset => asset.names?.includes('cloud.css') ? 'shared/cloud.css' : 'assets/[name]-[hash][extname]', entryFileNames: chunk => chunk.name === 'cloud' ? 'shared/cloud-[hash].js' : 'assets/[name]-[hash].js' },
      input: {
        portal: resolve(__dirname, 'index.html'),
        cloud: resolve(__dirname, 'src/cloud/bootstrap.js'),
        runningOps: resolve(__dirname, 'src-running-ops/index.html'),
      },
    },
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
