import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import officialMetricsHandler from './api/official-metrics.ts'

const proxy = {
  '/api/freeserp': {
    target: 'https://freeserp.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/freeserp/, '/api.php'),
  },
}

const localApiFunctions = () => ({
  name: 'local-api-functions',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: () => void) => {
      if (!req.url?.startsWith('/api/official-metrics')) return next()
      void officialMetricsHandler(req, res)
    })
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((req: any, res: any, next: () => void) => {
      if (!req.url?.startsWith('/api/official-metrics')) return next()
      void officialMetricsHandler(req, res)
    })
  },
})

export default defineConfig({ plugins: [react(), localApiFunctions()], server: { proxy }, preview: { proxy } })
