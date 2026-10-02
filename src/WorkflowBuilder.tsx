import { useEffect, useMemo, useState } from 'react'
import { searchTools, type Category, type Tool } from './api'
import { toTool, topServices } from './tops'
import './workflow.css'

type StageSeed = { title: string; category: Category; query: string }
type Stage = StageSeed & { id: number; results: Tool[]; selected: string; loading: boolean; error: string }
type Workflow = { id: string; title: string; description: string; stages: StageSeed[] }

const workflows: Workflow[] = [
  { id: 'video-campaign', title: 'Create a video campaign', description: 'Go from visual direction to a finished promotion.', stages: [
    { title: 'Shape the visual direction', category: 'image', query: 'AI image generator visual design' },
    { title: 'Generate the video', category: 'video', query: 'AI video generator text to video' },
    { title: 'Create a landing page', category: 'code', query: 'AI website builder coding assistant' },
  ] },
  { id: 'launch-product', title: 'Launch a product', description: 'Find tools for the brand, the product page and launch content.', stages: [
    { title: 'Create product visuals', category: 'image', query: 'AI product image generator' },
    { title: 'Build the product', category: 'code', query: 'AI coding assistant app development' },
    { title: 'Make a launch video', category: 'video', query: 'AI video generator product marketing' },
  ] },
  { id: 'build-app', title: 'Build an AI app', description: 'Choose tools for prototyping, interface design and a product demo.', stages: [
    { title: 'Prototype the app', category: 'code', query: 'AI coding assistant app prototype' },
    { title: 'Design the interface', category: 'image', query: 'AI UI design generator' },
    { title: 'Produce a demo video', category: 'video', query: 'AI screen demo video generator' },
  ] },
  { id: 'creator-kit', title: 'Make a creator kit', description: 'Build a repeatable image, video and publishing setup.', stages: [
    { title: 'Generate key images', category: 'image', query: 'AI image generator' },
    { title: 'Turn images into video', category: 'video', query: 'AI image to video generator' },
    { title: 'Build a portfolio page', category: 'code', query: 'AI portfolio website builder' },
  ] },
]

const categoryLabels: Record<Category, string> = { all: 'All tools', image: 'Images', video: 'Video', code: 'Code & Dev Tools' }
const nextId = () => Date.now() + Math.random()

function makeStages(definitions: StageSeed[]): Stage[] {
  return definitions.map(stage => ({ ...stage, id: nextId(), results: [], selected: '', loading: true, error: '' }))
}

export default function WorkflowBuilder() {
  const [active, setActive] = useState<Workflow | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [copyState, setCopyState] = useState('')
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>({})
  const [pricesLoading, setPricesLoading] = useState(false)

  const updateStage = (id: number, update: (stage: Stage) => Stage) => setStages(current => current.map(stage => stage.id === id ? update(stage) : stage))

  const findTools = async (stage: Stage) => {
    updateStage(stage.id, current => ({ ...current, loading: true, error: '' }))
    try {
      const result = await searchTools({ category: stage.category, query: stage.query, size: 8 })
      const curated = topServices.filter(service => stage.category === 'all' || service.category === stage.category).slice(0, 2).map(toTool)
      const tools = [...new Map([...curated, ...result.tools].map(tool => [tool.domain, tool])).values()]
      updateStage(stage.id, current => ({ ...current, results: tools, selected: tools.some(tool => tool.id === current.selected) ? current.selected : tools[0]?.id ?? '', loading: false, error: tools.length ? '' : 'No matching services found. Try a broader search.' }))
    } catch {
      updateStage(stage.id, current => ({ ...current, results: [], loading: false, error: 'The catalogue could not be reached. Check your connection and try again.' }))
    }
  }

  const startWorkflow = (workflow: Workflow) => {
    setActive(workflow)
    const initialStages = makeStages(workflow.stages)
    setStages(initialStages)
    setCopyState('')
    void Promise.all(initialStages.map(stage => findTools(stage)))
  }

  const selectedTools = useMemo(() => stages.flatMap(stage => {
    const tool = stage.results.find(result => result.id === stage.selected)
    return tool ? [tool] : []
  }), [stages])
  const priceRequestKey = [...new Set(selectedTools.map(tool => tool.domain))].sort().join('|')
  useEffect(() => {
    let current = true
    const selected = [...new Map(selectedTools.map(tool => [tool.domain, tool])).values()]
    const lookups = selected.filter(tool => !tool.pricing?.plans.some(plan => plan.currency === 'USD' && plan.amount !== null && /mo|month/i.test(plan.billingPeriod ?? ''))).flatMap(tool => {
      const service = topServices.find(candidate => candidate.domain === tool.domain)
      return service ? [{ domain: tool.domain, id: service.id }] : []
    })
    if (!lookups.length) { setPricesLoading(false); return () => { current = false } }
    setPricesLoading(true)
    void Promise.all(lookups.map(async ({ domain, id }) => {
      try {
        const response = await fetch(`/api/official-metrics?service=${encodeURIComponent(id)}&metric=subscriptionPrice`)
        const result = await response.json() as { value?: { values?: number[] } | null }
        return [domain, result.value?.values?.[0] ?? null] as const
      } catch { return [domain, null] as const }
    })).then(results => {
      if (current) setLivePrices(Object.fromEntries(results))
    }).finally(() => { if (current) setPricesLoading(false) })
    return () => { current = false }
  // The stable key prevents catalogue search text edits from refetching prices.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRequestKey])
  const monthlyCost = useMemo(() => {
    const unique = [...new Map(selectedTools.map(tool => [tool.domain, tool])).values()]
    const priced = unique.map(tool => ({ tool, plan: tool.pricing?.plans.find(plan => plan.currency === 'USD' && plan.amount !== null && /mo|month/i.test(plan.billingPeriod ?? '')) })).filter(item => item.plan)
    const withOfficialPrice = unique.filter(tool => !tool.pricing?.plans.some(plan => plan.currency === 'USD' && plan.amount !== null && /mo|month/i.test(plan.billingPeriod ?? '')) && livePrices[tool.domain] !== undefined && livePrices[tool.domain] !== null)
    const amount = priced.reduce((sum, item) => sum + (item.plan?.amount ?? 0), 0) + withOfficialPrice.reduce((sum, tool) => sum + (livePrices[tool.domain] ?? 0), 0)
    return { amount, pricedCount: priced.length + withOfficialPrice.length, selectedCount: unique.length }
  }, [selectedTools, livePrices])

  const addStage = (category: Category) => {
    const stage: Stage = { id: nextId(), title: `New ${categoryLabels[category].toLowerCase()} step`, category, query: '', results: [], selected: '', loading: false, error: '' }
    setStages(current => [...current, stage])
  }

  const copyPlan = async () => {
    if (!active) return
    const lines = [`# ${active.title}`, '', ...stages.map((stage, index) => {
      const tool = stage.results.find(result => result.id === stage.selected)
      return `${index + 1}. ${stage.title}${tool ? ` — ${tool.name} (${tool.homepageUrl})` : ' — no tool selected'}`
    })]
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopyState('Workflow copied') }
    catch { setCopyState('Could not copy this workflow') }
  }

  return <section className="workflow-page">
    <div className="workflow-heading"><div><p className="eyebrow">PLAN A WORKFLOW</p><h1>Build your workflow</h1><p>Choose a goal, then find real services for each step from the AI Finder catalogue.</p></div><span className="workflow-orbit" aria-hidden="true"><i /><b /><em>→</em></span></div>
    {!active ? <>
      <div className="workflow-section-head"><div><span className="section-index">01 / START WITH A GOAL</span><h2>What are you working on?</h2></div><span>Pick a starting point</span></div>
      <div className="workflow-templates">{workflows.map((workflow, index) => <button key={workflow.id} className="workflow-template" onClick={() => startWorkflow(workflow)}><span className="workflow-template-number">0{index + 1}</span><strong>{workflow.title}</strong><span>{workflow.description}</span><b>Build this workflow <i>↗</i></b></button>)}</div>
      <p className="workflow-footnote">Each step searches the live catalogue. You can change its category, search phrase or selected service.</p>
    </> : <>
      <div className="workflow-active-head"><div><button className="workflow-back" onClick={() => { setActive(null); setStages([]) }}>← All workflows</button><span className="section-index">YOUR WORKFLOW</span><h2>{active.title}</h2><p>{active.description}</p></div><button className="workflow-copy" onClick={() => void copyPlan()}>{copyState || 'Copy workflow'} <span>↗</span></button></div>
      <div className="workflow-steps">{stages.map((stage, index) => {
        const selected = stage.results.find(tool => tool.id === stage.selected)
        return <article className="workflow-step" key={stage.id}>
          <div className="workflow-step-marker"><span>{String(index + 1).padStart(2, '0')}</span>{index < stages.length - 1 && <i />}</div>
          <div className="workflow-step-content">
            <div className="workflow-step-top"><label className="workflow-stage-name"><span>STEP {String(index + 1).padStart(2, '0')}</span><input aria-label={`Step ${index + 1} name`} value={stage.title} onChange={event => updateStage(stage.id, current => ({ ...current, title: event.target.value }))} /></label><button className="workflow-remove" aria-label={`Remove step ${index + 1}`} onClick={() => setStages(current => current.filter(item => item.id !== stage.id))}>Remove</button></div>
            <div className="workflow-search-row"><label><span>Tool category</span><select value={stage.category} onChange={event => updateStage(stage.id, current => ({ ...current, category: event.target.value as Category, results: [], selected: '' }))}>{(['all', 'image', 'video', 'code'] as Category[]).map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label><label className="workflow-query"><span>Search the catalogue</span><input value={stage.query} placeholder="Describe what you need" onChange={event => updateStage(stage.id, current => ({ ...current, query: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void findTools(stage) }} /></label><button className="workflow-find" disabled={stage.loading} onClick={() => void findTools(stage)}>{stage.loading ? 'Searching…' : 'Find tools'} <span>↗</span></button></div>
            {stage.loading ? <div className="workflow-results-state">Searching the live catalogue…</div> : stage.error ? <div className="workflow-results-state">{stage.error}</div> : <div className="workflow-results">{stage.results.slice(0, 4).map(tool => <button key={tool.id} className={stage.selected === tool.id ? 'workflow-tool selected' : 'workflow-tool'} onClick={() => updateStage(stage.id, current => ({ ...current, selected: tool.id }))}><span className="workflow-tool-logo"><img src={tool.coverUrl ?? `https://${tool.domain}/favicon.ico`} alt="" onError={event => { event.currentTarget.style.display = 'none' }} /><i>{tool.name.slice(0, 1)}</i></span><span className="workflow-tool-name">{tool.name}<small>{tool.domain}</small></span>{stage.selected === tool.id && <b aria-label="Selected">✓</b>}</button>)}</div>}
            {selected && <div className="workflow-selected"><span className="workflow-selected-dot" /> Selected: <strong>{selected.name}</strong>{selected.pricing?.sourceUrl && <a href={selected.pricing.sourceUrl} target="_blank" rel="noopener noreferrer">Pricing source ↗</a>}</div>}
          </div>
        </article>
      })}</div>
      <div className="workflow-bottom"><div className="workflow-add-step"><span>Add a step</span>{(['image', 'video', 'code'] as const).map(category => <button key={category} onClick={() => addStage(category)}>+ {categoryLabels[category]}</button>)}</div><div className="workflow-estimate"><span>Published monthly plans · {monthlyCost.selectedCount} tools</span><strong>{pricesLoading ? 'Checking official prices…' : monthlyCost.pricedCount ? `$${monthlyCost.amount.toFixed(2)} / mo` : 'No price data yet'}</strong><small>{monthlyCost.pricedCount < monthlyCost.selectedCount ? `${monthlyCost.selectedCount - monthlyCost.pricedCount} selected ${monthlyCost.selectedCount - monthlyCost.pricedCount === 1 ? 'service has' : 'services have'} no published monthly plan.` : 'Based on official pricing pages and catalogue data.'}</small></div></div>
    </>}
  </section>
}
