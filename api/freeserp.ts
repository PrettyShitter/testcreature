export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const requestUrl = new URL(req.url ?? '/', 'https://ai-finder.vercel.app')
    const upstream = new URL('https://freeserp.ai/api.php')
    requestUrl.searchParams.forEach((value, key) => upstream.searchParams.append(key, value))

    const response = await fetch(upstream, {
      headers: { 'user-agent': 'AI-Finder/1.0 (catalogue proxy)' },
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.text()
    res.statusCode = response.status
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.end(body)
  } catch {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'Catalogue service is temporarily unavailable' }))
  }
}
