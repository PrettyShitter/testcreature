import pricingMetadata from './metadata.json'

export type Tool = {
  id: string
  domain: string
  name: string
  homepageUrl: string
  summary: string | null
  categories: string[]
  coverUrl: string | null
  pricing: { plans: Array<{ name: string; amount: number | null; currency: string | null; billingPeriod: string | null; billingNote?: string }>; sourceUrl: string | null; verifiedAt: string | null } | null
}

type Metadata = { displayName?: string; coverUrl?: string | null; coverSourceUrl?: string; coverVerifiedAt?: string; pricing?: NonNullable<Tool['pricing']> }
const metadata = pricingMetadata as Record<string, Metadata>

export type Category = 'all' | 'image' | 'video' | 'code'
export const categoryNames = {
  image: 'Image Generation',
  video: 'Video Generation',
  code: 'Code & Dev Tools',
} as const

type ApiResponse = { ok: boolean; index?: string; total: number; results: Array<Record<string, unknown>>; filters?: Record<string, unknown> }
const endpoint = '/api/freeserp'
const cache = new Map<string, { expires: number; value: ApiResponse }>()

export function normalize(row: Record<string, unknown>): Tool | null {
  const domain = typeof row.domain === 'string' ? row.domain.toLowerCase().replace(/^www\./, '') : ''
  const url = typeof row.url === 'string' ? row.url : ''
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.replace(/^www\./, '').toLowerCase() !== domain) return null
  } catch { return null }
  const sourceSummary = typeof row.ai_summary === 'string' ? row.ai_summary.trim() : ''
  const sourceTitle = typeof row.title === 'string' ? row.title.trim() : ''
  if (isEditorialOrDirectory(sourceTitle, sourceSummary)) return null
  const domainBrand = getDomainBrand(domain)
  const brandMatch = sourceTitle.match(new RegExp(escapeRegExp(domainBrand).replace(/\\-/g, '[\\s._-]?'), 'i'))?.[0]
  const name = metadata[domain]?.displayName ?? brandMatch ?? domainBrand
  const categories = Array.isArray(row.ai_categories) ? row.ai_categories.filter((x): x is string => typeof x === 'string') : []
  return {
    id: domain,
    domain,
    name: name || domain,
    homepageUrl: `https://${domain}`,
    summary: sourceSummary && !/[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]/u.test(sourceSummary) ? sourceSummary : null,
    categories,
    coverUrl: metadata[domain]?.coverUrl ?? `https://${domain}/favicon.ico`,
    pricing: metadata[domain]?.pricing ?? null,
  }
}

function getDomainBrand(domain: string) {
  const knownBrands: Record<string, string> = { '123rf.com': '123RF', 'x.ai': 'xAI', 'v0.app': 'v0' }
  if (knownBrands[domain]) return knownBrands[domain]
  const parts = domain.split('.')
  const compoundSuffixes = new Set(['co.uk', 'com.au', 'co.in', 'com.br', 'co.jp', 'com.cn'])
  const suffix = parts.slice(-2).join('.')
  const label = parts[parts.length - (compoundSuffixes.has(suffix) ? 3 : 2)] ?? parts[0]
  return label.split(/[-_]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isEditorialOrDirectory(title: string, summary: string) {
  const pageTitle = title.toLowerCase()
  const summaryText = summary.toLowerCase()
  return /\b(?:unofficial (?:guide|review)|reviews?|comparison|roundup|guide|blog|magazine|news|tutorials?|articles?|web ?log|personal portfolio|director(?:y|ies)|what (?:is|are)|(?:top|best) \d+ (?:ai |artificial intelligence )?(?:tools|apps|services)|publishing platform)\b/i.test(pageTitle)
    || /\b(?:unofficial guide and review|review site|personal portfolio|technology media (?:site|platform)|tech (?:news|media) (?:outlet|publication)|design articles,? .* tutorials|publishes? (?:articles|tutorials)|(?:blog|magazine) (?:that|offering|providing)|provides? (?:a library of|curated) (?:articles|tutorials)|(?:catalogue|directory|database) of (?:ai|software) tools)\b/i.test(summaryText)
}

export async function searchTools({ category = 'all', query = '', from = 0, size = 24, signal }: { category?: Category; query?: string; from?: number; size?: number; signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ index: 'sites', ai_startups: '1', size: String(size), from: String(from) })
  if (category !== 'all') params.set('ai_categories', categoryNames[category])
  if (query.trim()) params.set('q', query.trim())
  const raw = await request(params, signal)
  return { tools: dedupe(raw.results.map(normalize).filter((x): x is Tool => Boolean(x))), total: raw.total, filters: raw.filters ?? {} }
}

export async function getRecommendations(signal?: AbortSignal) {
  const configs = [
    { category: 'image' as const, preferred: 'openart.ai', query: 'AI image generator' },
    { category: 'video' as const, preferred: 'synthesia.io', query: '' },
    { category: 'code' as const, preferred: 'v0.app', query: 'AI coding assistant' },
  ]
  return Promise.all(configs.map(async ({ category, preferred, query }) => {
    const params = new URLSearchParams({ index: 'sites', ai_startups: '1', ai_categories: categoryNames[category], size: '100', from: '0' })
    if (query) params.set('q', query)
    const data = await request(params, signal)
    const tools = dedupe(data.results.map(normalize).filter((x): x is Tool => Boolean(x)))
    return { category, tool: tools.find(x => x.domain === preferred) ?? tools.find(x => x.categories.includes(categoryNames[category])) ?? null }
  }))
}

export async function getSimilar(tool: Tool, signal?: AbortSignal) {
  const matched = (['image', 'video', 'code'] as const).find(c => tool.categories.includes(categoryNames[c]))
  if (!matched) return []
  const { tools } = await searchTools({ category: matched, size: 24, signal })
  return tools.filter(x => x.domain !== tool.domain).slice(0, 6)
}

export function dedupe(tools: Tool[]) {
  const result = new Map<string, Tool>()
  for (const tool of tools) if (!result.has(tool.domain)) result.set(tool.domain, tool)
  return [...result.values()]
}

async function request(params: URLSearchParams, signal?: AbortSignal): Promise<ApiResponse> {
  const key = params.toString()
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(`${endpoint}?${key}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`FreeSERP responded with ${response.status}`)
      const data = await response.json() as ApiResponse
      if (!data.ok || !Array.isArray(data.results) || typeof data.total !== 'number') throw new Error('FreeSERP returned an unexpected response')
      const requested = new URLSearchParams(key)
      if (data.index !== 'sites' || data.filters?.ai_startups !== true || (requested.has('ai_categories') && data.filters?.ai_categories !== requested.get('ai_categories'))) throw new Error('FreeSERP did not confirm the required filters')
      cache.set(key, { expires: Date.now() + 5 * 60_000, value: data })
      return data
    } catch (error) {
      lastError = error
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load catalogue data')
}
