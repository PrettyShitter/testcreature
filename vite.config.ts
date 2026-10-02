import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

type Metric = 'subscriptionPrice' | 'imageUnitCost' | 'videoUnitCost' | 'monthlyUsage' | 'maxVideoDuration' | 'maxOutputResolution' | 'maxContextWindow'
const topServices = [
  { id: 'midjourney', name: 'Midjourney', category: 'image', pricing: 'https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans', docs: 'https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo' },
  { id: 'openai-images', name: 'OpenAI Images API', category: 'image', pricing: 'https://openai.com/api/pricing/', docs: 'https://developers.openai.com/api/docs/guides/image-generation' },
  { id: 'runway-images', name: 'Runway', category: 'image', pricing: 'https://runwayml.com/pricing', docs: 'https://docs.dev.runwayml.com/guides/pricing/' },
  { id: 'google-images', name: 'Google Gemini Image', category: 'image', pricing: 'https://ai.google.dev/gemini-api/docs/pricing?hl=en', docs: 'https://ai.google.dev/gemini-api/docs/image-generation?hl=en' },
  { id: 'ideogram', name: 'Ideogram', category: 'image', pricing: 'https://ideogram.ai/pricing' },
  { id: 'firefly', name: 'Adobe Firefly', category: 'image', pricing: 'https://www.adobe.com/products/firefly/plans.html' },
  { id: 'higgsfield', name: 'Higgsfield', category: 'video', pricing: 'https://higgsfield.ai/pricing', docs: 'https://open.higgsfield.ai/models/minimax/h3/text-to-video/playground' },
  { id: 'runway', name: 'Runway', category: 'video', pricing: 'https://runwayml.com/pricing', docs: 'https://docs.dev.runwayml.com/guides/pricing/', specs: 'https://docs.dev.runwayml.com/api-details/api_changelog/', specs2: 'https://docs.dev.runwayml.com/assets/inputs/' },
  { id: 'kling', name: 'Kling AI', category: 'video', pricing: 'https://klingai.com/membership/membership-plan' },
  { id: 'veo', name: 'Google Veo', category: 'video', pricing: 'https://ai.google.dev/gemini-api/docs/pricing?hl=en', docs: 'https://ai.google.dev/gemini-api/docs/veo?hl=en' },
  { id: 'luma', name: 'Luma Ray', category: 'video', pricing: 'https://lumalabs.ai/pricing', docs: 'https://lumalabs.ai/api' },
  { id: 'pika', name: 'Pika', category: 'video', pricing: 'https://pika.art/pricing' },
  { id: 'cursor', name: 'Cursor', category: 'code', pricing: 'https://cursor.com/pricing', docs: 'https://cursor.com/docs/models-and-pricing', specs: 'https://cursor.com/docs' },
  { id: 'github-copilot', name: 'GitHub Copilot', category: 'code', pricing: 'https://github.com/features/copilot/plans', docs: 'https://github.com/features/copilot/plans', specs: 'https://docs.github.com/en/copilot/reference/ai-models/supported-models' },
  { id: 'replit', name: 'Replit', category: 'code', pricing: 'https://replit.com/pricing', docs: 'https://replit.com/blog/pro-plan' },
  { id: 'windsurf', name: 'Windsurf', category: 'code', pricing: 'https://windsurf.com/pricing', docs: 'https://docs.windsurf.com/windsurf/accounts/usage' },
  { id: 'claude-code', name: 'Claude Code', category: 'code', pricing: 'https://claude.com/pricing', docs: 'https://docs.anthropic.com/en/docs/claude-code/overview' },
  { id: 'codex', name: 'OpenAI Codex', category: 'code', pricing: 'https://openai.com/chatgpt/pricing/', docs: 'https://developers.openai.com/codex/' },
]

// https://vite.dev/config/
const proxy = {
  '/api/freeserp': {
    target: 'https://freeserp.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/freeserp/, '/api.php'),
  },
}

const compareSources = () => {
  const cache = new Map<string, { at: number; result: unknown }>()
  const handler = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/official-metrics')) return next()
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('service')
    const metric = url.searchParams.get('metric') as Metric | null
    const service = topServices.find(item => item.id === id)
    if (!service || !metric || !['subscriptionPrice', 'imageUnitCost', 'videoUnitCost', 'monthlyUsage', 'maxVideoDuration', 'maxOutputResolution', 'maxContextWindow'].includes(metric)) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid service or metric' })); return
    }
    const key = `${id}:${metric}`
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < 30 * 60_000) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(cached.result)); return }
    const urls = [service.pricing, service.docs, service.specs, service.specs2].filter(Boolean) as string[]
    try {
      const settledPages = await Promise.allSettled(urls.map(async sourceUrl => {
        const response = await fetch(sourceUrl, { headers: { 'user-agent': 'AI-Finder/1.0 (official page metric parser)' }, signal: AbortSignal.timeout(9000) })
        if (!response.ok) throw new Error(`Official source returned ${response.status}`)
        const html = await response.text()
        const toText = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#36;|&dollar;/gi, '$').replace(/\s+/g, ' ')
        const text = toText(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '))
        const embeddedText = toText(html)
        return { sourceUrl, text, embeddedText }
      }))
      const pages = settledPages.flatMap(page => page.status === 'fulfilled' ? [page.value] : [])
      if (!pages.length) throw new Error('Official sources unavailable')
      let value: { values?: number[]; unit?: string; label?: string; sourceUrl?: string } | null = null
      if (metric === 'subscriptionPrice') {
        const page = pages.find(item => item.sourceUrl === service.pricing) ?? pages[0]
        const matches = [...page.text.matchAll(/\$\s?(\d+(?:\.\d{1,2})?)\s*(?:\/|per)\s*(?:(?:user|seat)\s*\/\s*)?(?:month|mo\b)/gi)]
          .filter(match => !/credit|usage|flex allotment|token|per generation/i.test(page.text.slice(Math.max(0, (match.index ?? 0) - 100), (match.index ?? 0) + match[0].length + 60)))
          .map(match => Number(match[1])).filter(n => n >= 1 && n < 1000)
        const amounts = [...new Set(matches)].sort((a, b) => a - b)
        if (amounts.length) value = { values: [amounts[0]], unit: 'USD / month', label: 'Lowest published paid monthly plan', sourceUrl: page.sourceUrl }
      }
      if (metric === 'monthlyUsage' && service.category === 'code') {
        const matched = pages.map(page => ({ page, match: service.id === 'cursor'
          ? page.text.match(/Pro includes \$\s?(\d+(?:\.\d+)?) of API agent usage/i)
          : service.id === 'github-copilot' ? page.embeddedText.match(/\$\s?(\d+(?:\.\d+)?) monthly total credits for Pro/i)
            : service.id === 'replit' ? page.embeddedText.match(/Core[\s\S]{0,500}?\$(\d+(?:\.\d+)?) of monthly credits/i) : null })).find(item => item.match)
        const match = matched?.match
        if (match && matched) value = { values: [Number(match[1])], unit: 'USD / month', label: 'Published included AI credits (plans differ)', sourceUrl: matched.page.sourceUrl }
      }
      if (metric === 'imageUnitCost' && service.category === 'image') {
        if (service.id === 'openai-images') {
          const page = pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
          const match = page.text.match(/GPT Image 2(?:\s+Additional sizes available)?\s+Low\s+\$(\d+(?:\.\d+)?)/i)
          if (match) value = { values: [Number(match[1])], unit: 'USD / image', label: 'Low-quality 1024×1024 API estimate (GPT Image 2)', sourceUrl: page.sourceUrl }
        }
        if (service.id === 'runway-images') {
          const page = pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
          const credits = page.text.match(/gen4_image\s+(\d+) credits per 720p image/i)
          const rate = page.text.match(/Credits can be purchased for \$(\d+(?:\.\d+)?) per credit/i)
          if (credits && rate) value = { values: [Number(credits[1]) * Number(rate[1])], unit: 'USD / image', label: `Runway Gen-4 Image API · ${credits[1]} credits per image`, sourceUrl: page.sourceUrl }
        }
        if (service.id === 'google-images') {
          const page = pages.find(item => item.sourceUrl === service.pricing) ?? pages[0]
          const match = page.text.match(/Output images at 1K[\s\S]{0,140}?equivalent to \$(\d+(?:\.\d+)?)/i)
          if (match) value = { values: [Number(match[1])], unit: 'USD / image', label: 'Gemini 3.1 Flash Image · standard 1K image', sourceUrl: page.sourceUrl }
        }
      }
      if (metric === 'videoUnitCost' && service.category === 'video') {
        if (service.id === 'higgsfield') {
          const page = pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
          const amount = page.embeddedText.match(/\\*"amount\\*":\\*"(\d+(?:\.\d+)?)\\*",\\*"currency\\*":\\*"USD\\*",\\*"unit\\*":\\*"second\\*"/i)
          if (amount) value = { values: [Number(amount[1])], unit: 'USD / second', label: `Higgsfield MiniMax H3 API · ${amount[1]} USD per second at 2K`, sourceUrl: page.sourceUrl }
        }
        if (service.id === 'runway') {
          const page = pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
          const match = page.text.match(/gen4\.5\s+(\d+) credits per second/i)
          const rate = page.text.match(/Credits can be purchased for \$(\d+(?:\.\d+)?) per credit/i)
          if (match && rate) value = { values: [Number(match[1]) * Number(rate[1])], unit: 'USD / second', label: 'Runway Gen-4.5 API · published credits per second', sourceUrl: page.sourceUrl }
        }
        if (service.id === 'veo') {
          const page = pages.find(item => item.sourceUrl === service.pricing) ?? pages[0]
          const match = page.text.match(/Veo 3\.1 Fast video with audio price \(default\)[\s\S]{0,120}?\$(\d+(?:\.\d+)?) \(720p\)/i)
          if (match) value = { values: [Number(match[1])], unit: 'USD / second', label: 'Veo 3.1 Fast · 720p video with audio', sourceUrl: page.sourceUrl }
        }
        if (service.id === 'luma') {
          const page = pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
          const match = page.text.match(/T2V\/I2V \(5s\)\s+\$\s?\d+(?:\.\d+)?\s+\$\s?(\d+(?:\.\d+)?)/i)
          if (match) value = { values: [Number((Number(match[1]) / 5).toFixed(3))], unit: 'USD / second', label: 'Luma Ray · 720p text/image-to-video, 5s rate converted to per second', sourceUrl: page.sourceUrl }
        }
      }
      if (metric === 'maxVideoDuration' && service.category === 'video') {
        const page = pages.find(item => item.sourceUrl === service.specs) ?? pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
        const match = service.id === 'higgsfield'
          ? page.text.match(/Duration\. Minimum:\s*(\d+)\. Maximum:\s*(\d+)/i) ?? page.embeddedText.match(/\\*"duration_range\\*"\s*:\s*\{[^}]*\\*"max_seconds\\*"\s*:\s*(\d+)/i) ?? page.embeddedText.match(/\\*"duration\\*"\s*:\s*\{[^}]*\\*"maximum\\*"\s*:\s*(\d+)/i)
          : service.id === 'runway' ? page.text.match(/Gen-4\.5 supports[\s\S]{0,180}?durations? from (\d+)\s*[–-]\s*(\d+) seconds/i)
            : service.id === 'veo' ? page.text.match(/generating (\d+)-second videos/i) : null
        const maximum = match ? Number(match[2] ?? match[1]) : null
        if (maximum) value = { values: [maximum], unit: 'seconds max', label: `${service.name} API · maximum clip duration for published model`, sourceUrl: page.sourceUrl }
      }
      if (metric === 'maxOutputResolution' && (service.category === 'image' || service.category === 'video')) {
        const page = service.id === 'runway' || service.id === 'runway-images' ? pages.find(item => item.sourceUrl === service.specs2) ?? pages.find(item => item.sourceUrl === service.docs) ?? pages[0] : pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
        let pixels: number | undefined
        if (service.id === 'google-images') pixels = Number(pages.find(item => item.sourceUrl === service.pricing)?.text.match(/Output images at 4K \((\d+)x/i)?.[1]) || undefined
        if (service.id === 'veo') pixels = /4k/i.test(page.text) ? 4096 : undefined
        if (service.id === 'higgsfield') pixels = /maximum_resolution\\*?"?\s*:\\*?"?2K/i.test(page.embeddedText) ? 2048 : Number(page.embeddedText.match(/\\*"maximum_resolution\\*":\\*"(\d+)K/i)?.[1]) * 1024 || undefined
        if (service.id === 'runway' || service.id === 'runway-images') {
          const all = [...page.text.matchAll(/(?:\b(?:gen4(?:\.5|_image)?|Gen-4(?:\.5)?)[^\n]{0,90}?)(\d{3,4})\s*[:×x]\s*(\d{3,4})/gi)]
          pixels = all.length ? Math.max(...all.flatMap(match => [Number(match[1]), Number(match[2])])) : undefined
        }
        if (service.id === 'openai-images') {
          const all = [...page.text.matchAll(/(\d{3,4})\s*[×x]\s*(\d{3,4})/gi)]
          pixels = all.length ? Math.max(...all.flatMap(match => [Number(match[1]), Number(match[2])])) : undefined
        }
        if (service.id === 'luma') pixels = Number(page.text.match(/1080p/i) ? 1080 : 0) || undefined
        if (pixels) value = { values: [pixels], unit: 'px long edge', label: `${service.name} API · largest output size found in official docs`, sourceUrl: page.sourceUrl }
      }
      if (metric === 'maxContextWindow' && service.category === 'code') {
        const page = pages.find(item => item.sourceUrl === service.specs) ?? pages.find(item => item.sourceUrl === service.docs) ?? pages[0]
        let count: number | undefined
        if (service.id === 'github-copilot' && /1 million token context window/i.test(page.text)) count = 1_000_000
        if (service.id === 'cursor') {
          const section = page.text.match(/Max Context([\s\S]{0,4000}?)(?:Show more models|More resources)/i)?.[1] ?? ''
          const sizes = [...section.matchAll(/\b(\d+)\s*(k|m)\b/gi)].map(match => Number(match[1]) * (match[2].toLowerCase() === 'm' ? 1_000_000 : 1_000))
          if (sizes.length) count = Math.max(...sizes)
        }
        if (count) value = { values: [count], unit: 'tokens max', label: `${service.name} · largest documented model context`, sourceUrl: page.sourceUrl }
      }
      const result = { service: service.name, metric, value, verifiedAt: new Date().toISOString(), message: value ? undefined : `${service.name}: this metric is not published in a comparable form on the official pages.` }
      cache.set(key, { at: Date.now(), result })
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result))
    } catch {
      const result = { service: service.name, metric, value: null, verifiedAt: new Date().toISOString(), message: `${service.name}: official source could not be read right now.` }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result))
    }
  }
  return { name: 'official-metric-parser', configureServer(server: any) { server.middlewares.use(handler) }, configurePreviewServer(server: any) { server.middlewares.use(handler) } }
}

export default defineConfig({ plugins: [react(), compareSources()], server: { proxy }, preview: { proxy } })
