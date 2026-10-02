import { useCallback, useEffect, useRef, useState } from 'react'
import { categoryNames, getRecommendations, getSimilar, searchTools, type Category, type Tool } from './api'
import { metricLabels, topServices, toTool, type Metric, type TopCategory } from './tops'
import WorkflowBuilder from './WorkflowBuilder'
import './style.css'

const categories: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'image', label: 'Images' }, { id: 'video', label: 'Video' }, { id: 'code', label: 'Code & Dev Tools' },
]
const categoryLabel = (tool: Tool) => tool.categories[0] ?? 'AI tool'
const taskLabels: Record<string, string> = { image: 'CREATE IMAGES', video: 'CREATE VIDEOS', code: 'BUILD WITH CODE' }
const renderTimestamp = Date.now()
type MetricResponse = { service: string; value: { values: number[]; unit: string; label: string; sourceUrl: string } | null; message?: string }
const metricsByCategory: Record<TopCategory, Metric[]> = {
  image: ['subscriptionPrice', 'imageUnitCost', 'maxOutputResolution'], video: ['subscriptionPrice', 'videoUnitCost', 'maxVideoDuration', 'maxOutputResolution'], code: ['subscriptionPrice', 'monthlyUsage', 'maxContextWindow'],
}

function App() {
  const initial = new URLSearchParams(location.search)
  const [category, setCategory] = useState<Category>((['all', 'image', 'video', 'code'].includes(initial.get('category') ?? '') ? initial.get('category') : 'all') as Category)
  const [input, setInput] = useState(initial.get('q') ?? '')
  const [query, setQuery] = useState(initial.get('q') ?? '')
  const [items, setItems] = useState<Tool[]>([])
  const [total, setTotal] = useState(0)
  const [recommendations, setRecommendations] = useState<{ category: string; tool: Tool | null }[]>([])
  const [recommendationFailed, setRecommendationFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [nextFrom, setNextFrom] = useState(0)
  const nextFromRef = useRef(0)
  const [active, setActive] = useState<Tool | null>(null)
  const [dialogMode, setDialogMode] = useState<'closed' | 'pinned'>('closed')
  const [similar, setSimilar] = useState<{ title: string; tools: Tool[] } | null>(null)
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarError, setSimilarError] = useState('')
  const [about, setAbout] = useState(location.pathname === '/about')
  const [view, setView] = useState<'search' | 'tops' | 'workflow'>('search')
  const [topCategory, setTopCategory] = useState<TopCategory | ''>('')
  const [firstService, setFirstService] = useState('')
  const [secondService, setSecondService] = useState('')
  const [compared, setCompared] = useState(false)
  const [metric, setMetric] = useState<Metric>('subscriptionPrice')
  const [metricData, setMetricData] = useState<MetricResponse[]>([])
  const [metricOptions, setMetricOptions] = useState<Metric[]>(['subscriptionPrice'])
  const [metricSets, setMetricSets] = useState<Partial<Record<Metric, MetricResponse[]>>>({})
  const [metricLoading, setMetricLoading] = useState(false)
  const skipUrlPush = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const similarRequest = useRef<{ domain: string; controller: AbortController } | null>(null)
  const cardRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async (opts: { reset?: boolean; more?: boolean } = {}) => {
    const from = opts.more ? nextFromRef.current : 0
    if (opts.more) { setMoreLoading(true); setMoreError('') } else { abortRef.current?.abort(); setLoading(true); setError(''); setItems([]); nextFromRef.current = 0; setNextFrom(0) }
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await searchTools({ category, query, from, size: 24, signal: controller.signal })
      if (controller.signal.aborted) return
      setItems(previous => opts.more ? [...new Map([...previous, ...result.tools].map(tool => [tool.domain, tool])).values()] : result.tools)
      setTotal(result.total)
      nextFromRef.current = from + 24
      setNextFrom(nextFromRef.current)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('FreeSERP catalog request failed:', e)
        if (opts.more) setMoreError('Could not load the next page.')
        else setError('The catalogue is temporarily unavailable. Check your connection and try again.')
      }
    } finally { if (!controller.signal.aborted) { setLoading(false); setMoreLoading(false) } }
  }, [category, query])

  useEffect(() => {
    const controller = new AbortController()
    getRecommendations(controller.signal).then(value => { setRecommendations(value); setRecommendationFailed(false) }).catch(e => { if ((e as Error).name !== 'AbortError') setRecommendationFailed(true) })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => { window.clearTimeout(timer); abortRef.current?.abort() }
  }, [load])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 350)
    return () => clearTimeout(timer)
  }, [input])
  useEffect(() => {
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (query) params.set('q', query)
    const suffix = params.toString()
    const nextUrl = `${location.pathname}${suffix ? `?${suffix}` : ''}`
    if (skipUrlPush.current) { skipUrlPush.current = false; history.replaceState({}, '', nextUrl) }
    else history.pushState({}, '', nextUrl)
  }, [category, query])
  useEffect(() => {
    const pop = () => {
      skipUrlPush.current = true
      const params = new URLSearchParams(location.search)
      setCategory((['all', 'image', 'video', 'code'].includes(params.get('category') ?? '') ? params.get('category') : 'all') as Category)
      setInput(params.get('q') ?? '')
      setQuery(params.get('q') ?? '')
      setAbout(location.pathname === '/about')
    }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    if (dialogMode === 'pinned') {
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialogRef.current?.focus()
      return () => { document.body.style.overflow = previous }
    }
  }, [dialogMode])
  const closeDialog = () => {
    const restoreFocus = dialogMode === 'pinned'
    setDialogMode('closed'); setActive(null)
    if (restoreFocus) requestAnimationFrame(() => cardRef.current?.focus())
  }
  const onCardClick = (tool: Tool, target: HTMLButtonElement) => {
    cardRef.current = target; setActive(tool); setDialogMode('pinned')
  }
  const handleCategory = (value: Category) => { setCategory(value); setNextFrom(0) }
  const handleExternal = (tool: Tool) => {
    if (similarRequest.current?.domain === tool.domain) return
    similarRequest.current?.controller.abort()
    const controller = new AbortController()
    setSimilar({ title: tool.name, tools: [] }); setSimilarLoading(true); setSimilarError('')
    similarRequest.current = { domain: tool.domain, controller }
    void getSimilar(tool, controller.signal).then(tools => { if (!controller.signal.aborted) setSimilar({ title: tool.name, tools }) }).catch(e => { if ((e as Error).name !== 'AbortError') setSimilarError('Similar tools could not be loaded.') }).finally(() => { if (similarRequest.current?.controller === controller) { similarRequest.current = null; setSimilarLoading(false) } })
  }
  const navigate = (toAbout: boolean) => {
    history.pushState({}, '', toAbout ? '/about' : '/')
    setAbout(toAbout)
    if (!toAbout) setView('search')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const retry = () => void load()
  const categoryServices = topServices.filter(service => service.category === topCategory)
  const selectedName = (id: string) => topServices.find(service => service.id === id)?.name ?? id
  const compareServices = async () => {
    if (!topCategory || !firstService || !secondService) return
    setCompared(true); setMetricLoading(true); setMetricData([]); setMetricOptions([]); setMetricSets({})
    const metrics = metricsByCategory[topCategory]
    const sets = await Promise.all(metrics.map(async key => {
      const responses = await Promise.all([firstService, secondService].map(async id => {
        try {
          const response = await fetch(`/api/official-metrics?service=${encodeURIComponent(id)}&metric=${key}`)
          return await response.json() as MetricResponse
        } catch { return { service: selectedName(id), value: null, message: `${selectedName(id)}: official data could not be loaded.` } }
      }))
      return [key, responses] as const
    }))
    const record = Object.fromEntries(sets) as Partial<Record<Metric, MetricResponse[]>>
    const available = metrics.filter(key => record[key]?.every(result => result.value))
    setMetricSets(record); setMetricOptions(available)
    const preferred = available.includes('subscriptionPrice') ? 'subscriptionPrice' : available[0]
    const chosen = preferred ?? 'subscriptionPrice'
    setMetric(chosen); setMetricData(record[chosen] ?? [])
    setMetricLoading(false)
  }

  return <>
    <header className="site-header">
      <button className="brand" onClick={() => navigate(false)} aria-label="AI Finder — go to Search"><span className="brand-mark">A<span>I</span></span><span>AI Finder<small>Find the right AI tool</small></span></button>
      <nav className="primary-tabs" aria-label="Main navigation"><button className={view === 'search' ? 'primary-tab active' : 'primary-tab'} onClick={() => setView('search')}>Search</button><button className={view === 'tops' ? 'primary-tab active' : 'primary-tab'} onClick={() => setView('tops')}>Tops</button><button className={view === 'workflow' ? 'primary-tab active' : 'primary-tab'} onClick={() => setView('workflow')}>Workflow</button></nav>
      <div className="header-note"><span className="live-dot" /> FreeSERP catalogue</div>
    </header>

    {about ? <main className="about-page"><button className="back-link" onClick={() => navigate(false)}>Back to catalogue</button><p className="eyebrow">About</p><h1>Find the right tool<br />for the job</h1><p>AI Finder is a catalogue of AI products for images, video, software development and more. Service information comes from FreeSERP’s public index.</p><p>Categories and descriptions may be incomplete or inaccurate because they reflect the source’s classification. Prices are checked on each service’s official website.</p><a href="https://freeserp.ai/docs.php" target="_blank" rel="noopener noreferrer">How FreeSERP works</a></main> : <main>
      {view === 'workflow' ? <WorkflowBuilder /> : view === 'search' ? <>
      <section className="intro"><div><p className="eyebrow">FIND YOUR NEXT TOOL</p><h1>Pick your Setup</h1></div><p className="intro-copy">Find AI tools for images, video or code — then explore the full catalogue.</p></section>

      <section className="recommend-section" aria-labelledby="recs-heading">
        <div className="section-heading"><div><span className="section-index">01 / EDITOR’S PICKS</span><h2 id="recs-heading">Top 3 tools in each category</h2></div><span className="heading-rule" /></div>
        <div className="recommend-grid">{(['image', 'video', 'code'] as TopCategory[]).map((kind, index) => {
          const curated = topServices.find(service => service.category === kind)
          const rec = curated ? toTool(curated) : recommendations.find(x => x.category === kind)?.tool ?? null
            return <div className={`recommend-card rec-${kind}`} key={kind}>
            <div className="rec-topline"><span>0{index + 1}</span><span>{taskLabels[kind]}</span></div>
            {rec ? <button className="recommend-main" onClick={e => onCardClick(rec, e.currentTarget)}>
              <Cover tool={rec} size="large" /><span className="rec-name">{rec.name}</span><span className="rec-desc">{rec.summary?.split(/[.!?]/)[0] ?? categoryLabel(rec)}</span><span className="rec-domain">{rec.domain}</span>
            </button> : recommendationFailed ? <button className="rec-unavailable" onClick={() => { setRecommendationFailed(false); getRecommendations().then(setRecommendations).catch(() => setRecommendationFailed(true)) }}>No recommendation found · Try again</button> : <div className="rec-loading"><span className="cover-fallback large"><span>AI</span></span><span className="skeleton-line" /></div>}
          </div>
        })}</div>
      </section>

      <section className="catalog-section" aria-labelledby="catalog-heading">
        <div className="section-heading catalog-heading"><div><span className="section-index">02 / CATALOGUE</span><h2 id="catalog-heading">What are you looking for?</h2></div><span className="result-count">{loading ? 'Loading…' : `${total.toLocaleString('en-US')} indexed sites`}</span></div>
        <div className="catalog-controls"><div className="filters" role="tablist" aria-label="Tool category">{categories.map(item => <button key={item.id} role="tab" aria-selected={category === item.id} className={category === item.id ? 'filter active' : 'filter'} onClick={() => handleCategory(item.id)}>{item.label}</button>)}</div>
          <label className="search"><span className="search-icon" aria-hidden="true">⌕</span><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setQuery(input.trim()) }} placeholder="Search AI tools" aria-label="Search AI tools" />{input && <button className="clear-search" onClick={() => { setInput(''); setQuery('') }} aria-label="Clear search">×</button>}</label>
        </div>
        {similar && <section className="similar-panel" aria-live="polite"><div className="similar-title"><div><span className="section-index">YOU MAY ALSO LIKE</span><h3>Similar to {similar.title}</h3></div><button className="text-button" onClick={() => { similarRequest.current?.controller.abort(); similarRequest.current = null; setSimilarLoading(false); setSimilar(null) }}>Hide <span aria-hidden="true">×</span></button></div>{similarLoading ? <p className="quiet">Finding similar tools…</p> : similarError ? <p className="quiet">{similarError}</p> : similar.tools.length ? <div className="similar-list">{similar.tools.map(tool => <button key={tool.id} className="similar-chip" onClick={() => onCardClick(tool, document.activeElement as HTMLButtonElement)}><Cover tool={tool} size="small" /><span>{tool.name}</span></button>)}</div> : <p className="quiet">No similar tools found.</p>}</section>}
        {loading ? <div className="tool-grid" aria-label="Loading catalogue">{Array.from({ length: 12 }, (_, i) => <div className="tool-skeleton" key={i}><div /><span /><small /></div>)}</div> : error ? <div className="state-box"><span className="state-mark">!</span><h3>Could not load the catalogue</h3><p>{error}</p><button className="button-dark" onClick={retry}>Try again</button></div> : items.length === 0 ? <div className="state-box"><span className="state-mark">∅</span><h3>No tools found</h3><p>Try a different search or choose another category.</p><button className="button-dark" onClick={() => { setInput(''); setQuery(''); handleCategory('all') }}>Clear filters</button></div> : <>
          <div className="tool-grid">{items.map(tool => <ToolCard key={tool.id} tool={tool} categoryLabel={category === 'all' ? undefined : categoryNames[category]} onClick={onCardClick} />)}</div>
          <div className="load-more-wrap">{moreError && <p role="alert" className="more-error">{moreError}</p>}{nextFrom < total && <button className="load-more" disabled={moreLoading} onClick={() => void load({ more: true })}>{moreLoading ? 'Loading…' : 'Show more'}</button>}</div>
        </>}
      </section>
      </> : <section className="tops-page"><p className="eyebrow">CURATED SHORTLISTS</p><h1>Top tools</h1><p className="tops-intro">Three standout services in each category, followed by a side-by-side comparison using their official pages.</p>
        <div className="top-pick-strip">{(['image', 'video', 'code'] as TopCategory[]).map(kind => <div className="top-pick" key={kind}><span>{kind === 'image' ? 'IMAGES' : kind === 'video' ? 'VIDEO' : 'CODE & DEV'}</span><strong>{topServices.filter(service => service.category === kind).slice(0, 3).map(service => service.name).join(' · ')}</strong></div>)}</div>
        <div className="compare-box"><span className="section-index">COMPARE TWO TOOLS</span><label className="compare-field"><span>Choose a direction</span><select value={topCategory} onChange={e => { setTopCategory(e.target.value as TopCategory | ''); setFirstService(''); setSecondService(''); setCompared(false) }}><option value="">Select category</option><option value="image">Images</option><option value="video">Video</option><option value="code">Code & Dev Tools</option></select></label>
          <div className="compare-selectors"><label className="compare-field"><span>First service</span><select disabled={!topCategory} value={firstService} onChange={e => { setFirstService(e.target.value); setCompared(false) }}><option value="">Choose a service</option>{categoryServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label className="compare-field"><span>Second service</span><select disabled={!topCategory || !firstService} value={secondService} onChange={e => { setSecondService(e.target.value); setCompared(false) }}><option value="">Choose a service</option>{categoryServices.filter(service => service.id !== firstService).map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><button className="compare-button" disabled={!firstService || !secondService} onClick={() => void compareServices()}>Compare <span>↗</span></button></div>
        </div>
        {compared && <section className="comparison" aria-live="polite"><div className="comparison-head"><div><span className="section-index">OFFICIAL SOURCE COMPARISON</span><h2>{selectedName(firstService)} <i>vs</i> {selectedName(secondService)}</h2></div><label className="metric-select"><span>Compare by</span><select value={metric} disabled={metricLoading || metricOptions.length === 0} onChange={e => { const key = e.target.value as Metric; setMetric(key); setMetricData(metricSets[key] ?? []) }}>{metricLoading && <option value="subscriptionPrice">Finding metrics…</option>}{!metricLoading && metricOptions.length === 0 && <option value="subscriptionPrice">No comparable metrics found</option>}{metricOptions.map(key => <option key={key} value={key}>{metricLabels[key]}</option>)}</select></label></div>
          {metricLoading ? <div className="chart-loading">Checking official pricing and documentation…</div> : metricData.length === 0 || metricData.some(result => !result.value) ? <div className="unavailable-list">{(metricData.length ? metricData : [{ service: selectedName(firstService), value: null, message: `${selectedName(firstService)}: no comparable official metric was found for this pair.` }, { service: selectedName(secondService), value: null, message: `${selectedName(secondService)}: no comparable official metric was found for this pair.` }]).filter(result => !result.value).map(result => <p key={result.service}><strong>{result.service}</strong> — {result.message ?? 'data is unavailable from official sources.'}</p>)}</div> : <ComparisonChart results={metricData} />}
          <p className="source-note">Available filters are detected from each pair’s official pricing pages and docs when you compare. Model, quality, and usage assumptions appear beside the source.</p>
        </section>}
      </section>}
    </main>}
    <footer><button className="brand footer-brand" onClick={() => navigate(false)}><span className="brand-mark">A<span>I</span></span><span>AI Finder<small>Stay curious</small></span></button><span>AI tools catalogue · Data source: FreeSERP</span><button className="footer-link" onClick={() => navigate(!about)}>{about ? 'Home' : 'About'}</button></footer>

    {active && dialogMode === 'pinned' && <div className="dialog-layer" onPointerDown={e => { if (e.target === e.currentTarget) closeDialog() }}>
      <div className="dialog-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1} onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return }
        if (e.key === 'Tab') { const focusables = [...(dialogRef.current?.querySelectorAll<HTMLElement>('a,button,[tabindex="0"]') ?? [])]; if (!focusables.length) return; if (e.shiftKey && document.activeElement === focusables[0]) { e.preventDefault(); focusables.at(-1)?.focus() } else if (!e.shiftKey && document.activeElement === focusables.at(-1)) { e.preventDefault(); focusables[0].focus() } }
      }}>
        <button className="dialog-close" onClick={() => closeDialog()} aria-label="Close dialog">×</button>
        <div className="dialog-hero"><Cover tool={active} size="large" /><div><span className="dialog-domain">{active.domain}</span><h2 id="dialog-title">{active.name}</h2><span className="dialog-category">{active.categories.find(c => c === (category === 'all' ? undefined : categoryNames[category])) ?? categoryLabel(active)}</span></div></div>
        <p className="dialog-summary">{active.summary ?? `AI tool in the ${categoryLabel(active)} category. Visit the service website for details.`}</p>
        <div className="pricing"><div className="pricing-head"><h3>Pricing</h3><span>{active.pricing ? `Verified ${new Date(active.pricing.verifiedAt ?? '').toLocaleDateString('en-US')}${renderTimestamp - new Date(active.pricing.verifiedAt ?? '').getTime() > 30 * 86_400_000 ? ' · check for updates' : ''}` : 'Pricing source unavailable'}</span></div>{active.pricing ? <div className="pricing-plans">{active.pricing.plans.slice(0, 3).map(plan => <div className="pricing-plan" key={plan.name}><span>{plan.name}</span><strong>{plan.amount === 0 ? '0' : plan.amount === null ? 'Custom' : `${plan.currency === 'USD' ? '$' : ''}${plan.amount}`}<small>{plan.amount === 0 ? 'free' : plan.billingPeriod}</small></strong>{plan.billingNote && <small className="billing-note">{plan.billingNote}</small>}</div>)}</div> : <p>Pricing is unavailable. Check the service website.</p>}</div>
        <a className="pricing-link" href={active.pricing?.sourceUrl ?? active.homepageUrl} target="_blank" rel="noopener noreferrer">{active.pricing ? 'Official pricing page' : 'Official website'}</a>
        <a className="button-accent" href={active.homepageUrl} target="_blank" rel="noopener noreferrer" onClick={() => handleExternal(active)}>Visit website <span>↗</span></a>
      </div>
    </div>}
  </>
}

function Cover({ tool, size = 'normal' }: { tool: Tool; size?: 'normal' | 'large' | 'small' }) {
  const letter = tool.domain.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase()
  const category = tool.categories.some(x => x.includes('Image')) ? 'visual' : tool.categories.some(x => x.includes('Video')) ? 'motion' : 'code'
  return <span className={`cover-fallback ${size} motif-${category}`} aria-hidden="true"><span>{letter || 'AI'}</span><i /><b />{tool.coverUrl && <img key={tool.domain} className="cover-logo" src={tool.coverUrl} alt="" onError={e => { const image = e.currentTarget; if (!image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tool.domain)}&sz=128` } else image.remove() }} />}</span>
}

function ComparisonChart({ results }: { results: MetricResponse[] }) {
  const values = results.map(result => result.value?.values[0] ?? 0)
  const max = Math.max(...values, 1)
  return <div className="comparison-chart" role="img" aria-label={`${results[0].service}: ${values[0]} ${results[0].value?.unit}; ${results[1].service}: ${values[1]} ${results[1].value?.unit}`}>
    <div className="chart-unit">{results[0].value?.label} · {results[0].value?.unit}</div>
    {results.map((result, index) => <div className="chart-row" key={result.service}><div className="chart-label"><strong>{result.service}</strong><b>{result.value?.unit.startsWith('USD') ? '$' : ''}{values[index]}</b></div><div className="chart-track"><div className={`chart-bar chart-bar-${index}`} style={{ width: `${Math.max(values[index] / max * 100, 2)}%` }} /></div><a href={result.value?.sourceUrl} target="_blank" rel="noopener noreferrer">Official source ↗</a></div>)}
    <div className="chart-scale"><span>Lower cost / price</span><span>Higher cost / price</span></div>
  </div>
}

function ToolCard({ tool, categoryLabel: filteredLabel, onClick }: { tool: Tool; categoryLabel?: string; onClick: (tool: Tool, target: HTMLButtonElement) => void }) {
  return <button className="tool-card" data-domain={tool.domain} onClick={e => onClick(tool, e.currentTarget)}>
    <Cover tool={tool} /><span className="tool-card-title">{tool.name}</span><span className="tool-card-category">{filteredLabel ?? categoryLabel(tool)}</span>
  </button>
}

export default App
