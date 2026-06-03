import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vercel: VERCEL_ENV = production | preview | development */
const portalBuildEnv = process.env.VERCEL_ENV || 'development'

/** public/idea-bank, marathon-log — trailing slash → index.html (Vercel rewrite와 동일) */
const PORTAL_STATIC_APPS = ['idea-bank', 'marathon-log']

function portalStaticAppsPlugin() {
  const rewrite = (req) => {
    const raw = req.url || ''
    const [pathname, search = ''] = raw.split('?')
    for (const app of PORTAL_STATIC_APPS) {
      if (pathname === `/${app}` || pathname === `/${app}/`) {
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
export default defineConfig({
  plugins: [react(), portalStaticAppsPlugin()],
  define: {
    __PORTAL_BUILD_ENV__: JSON.stringify(portalBuildEnv),
  },
})
