import type { Tool, Category } from './api.js'

export type TopCategory = Exclude<Category, 'all'>
export type Metric = 'subscriptionPrice' | 'imageUnitCost' | 'videoUnitCost' | 'monthlyUsage' | 'maxVideoDuration' | 'maxOutputResolution' | 'maxContextWindow'
export const metricLabels: Record<Metric, string> = {
  subscriptionPrice: 'Subscription price', imageUnitCost: 'API cost per image', videoUnitCost: 'API cost per video second', monthlyUsage: 'Included monthly AI credits', maxVideoDuration: 'Maximum video duration', maxOutputResolution: 'Maximum output resolution', maxContextWindow: 'Maximum context window',
}

export type TopService = {
  id: string; category: TopCategory; name: string; domain: string; homepage: string; pricing: string; docs?: string; specs?: string; specs2?: string; summary: string
}

export const topServices: TopService[] = [
  { id: 'midjourney', category: 'image', name: 'Midjourney', domain: 'midjourney.com', homepage: 'https://www.midjourney.com', pricing: 'https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans', docs: 'https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo', summary: 'A leading creative image platform known for expressive, polished visual results.' },
  { id: 'openai-images', category: 'image', name: 'OpenAI Images API', domain: 'openai.com', homepage: 'https://developers.openai.com/api/docs/guides/image-generation', pricing: 'https://openai.com/api/pricing/', docs: 'https://developers.openai.com/api/docs/guides/image-generation', summary: 'Image generation with GPT Image models and published per-image API estimates.' },
  { id: 'runway-images', category: 'image', name: 'Runway', domain: 'runwayml.com', homepage: 'https://runwayml.com', pricing: 'https://runwayml.com/pricing', docs: 'https://docs.dev.runwayml.com/guides/pricing/', summary: 'A creative suite and API for AI image generation and editing.' },
  { id: 'google-images', category: 'image', name: 'Google Gemini Image', domain: 'ai.google.dev', homepage: 'https://ai.google.dev/gemini-api/docs/image-generation', pricing: 'https://ai.google.dev/gemini-api/docs/pricing', docs: 'https://ai.google.dev/gemini-api/docs/image-generation', summary: 'Gemini image generation with published per-image pricing and output sizes.' },
  { id: 'ideogram', category: 'image', name: 'Ideogram', domain: 'ideogram.ai', homepage: 'https://ideogram.ai', pricing: 'https://ideogram.ai/pricing', summary: 'An image generation service known for strong typography and design controls.' },
  { id: 'firefly', category: 'image', name: 'Adobe Firefly', domain: 'adobe.com', homepage: 'https://firefly.adobe.com', pricing: 'https://www.adobe.com/products/firefly/plans.html', summary: 'Adobe’s image and design generation tools with published plan pricing.' },
  { id: 'higgsfield', category: 'video', name: 'Higgsfield', domain: 'higgsfield.ai', homepage: 'https://higgsfield.ai', pricing: 'https://higgsfield.ai/pricing', docs: 'https://open.higgsfield.ai/models/minimax/h3/text-to-video/playground', summary: 'A creator-focused video platform with cinematic controls and current generation models.' },
  { id: 'runway', category: 'video', name: 'Runway', domain: 'runwayml.com', homepage: 'https://runwayml.com', pricing: 'https://runwayml.com/pricing', docs: 'https://docs.dev.runwayml.com/guides/pricing/', specs: 'https://docs.dev.runwayml.com/api-details/api_changelog/', specs2: 'https://docs.dev.runwayml.com/assets/inputs/', summary: 'A creative suite and API for AI video generation and editing.' },
  { id: 'kling', category: 'video', name: 'Kling AI', domain: 'klingai.com', homepage: 'https://klingai.com', pricing: 'https://klingai.com/membership/membership-plan', summary: 'A popular text-to-video and image-to-video generation service.' },
  { id: 'veo', category: 'video', name: 'Google Veo', domain: 'ai.google.dev', homepage: 'https://ai.google.dev/gemini-api/docs/veo', pricing: 'https://ai.google.dev/gemini-api/docs/pricing', docs: 'https://ai.google.dev/gemini-api/docs/veo', summary: 'Google’s video generation models with documented per-second API pricing.' },
  { id: 'luma', category: 'video', name: 'Luma Ray', domain: 'lumalabs.ai', homepage: 'https://lumalabs.ai', pricing: 'https://lumalabs.ai/pricing', docs: 'https://lumalabs.ai/api', summary: 'Ray video generation with official API pricing by model, resolution and duration.' },
  { id: 'pika', category: 'video', name: 'Pika', domain: 'pika.art', homepage: 'https://pika.art', pricing: 'https://pika.art/pricing', summary: 'A creator-friendly video generation service with published membership plans.' },
  { id: 'cursor', category: 'code', name: 'Cursor', domain: 'cursor.com', homepage: 'https://cursor.com', pricing: 'https://cursor.com/pricing', docs: 'https://cursor.com/docs/models-and-pricing', specs: 'https://cursor.com/docs', summary: 'An AI-first code editor with agentic coding and model choice.' },
  { id: 'github-copilot', category: 'code', name: 'GitHub Copilot', domain: 'github.com', homepage: 'https://github.com/features/copilot', pricing: 'https://github.com/features/copilot/plans', docs: 'https://github.com/features/copilot/plans', specs: 'https://docs.github.com/en/copilot/reference/ai-models/supported-models', summary: 'AI coding assistance integrated across editors and GitHub.' },
  { id: 'replit', category: 'code', name: 'Replit', domain: 'replit.com', homepage: 'https://replit.com', pricing: 'https://replit.com/pricing', docs: 'https://replit.com/pricing', summary: 'An AI-powered development environment with agent tools and hosted apps.' },
  { id: 'windsurf', category: 'code', name: 'Windsurf', domain: 'windsurf.com', homepage: 'https://windsurf.com', pricing: 'https://windsurf.com/pricing', docs: 'https://docs.windsurf.com/windsurf/accounts/usage', summary: 'An agentic coding editor with Cascade and published plan pricing.' },
  { id: 'claude-code', category: 'code', name: 'Claude Code', domain: 'claude.com', homepage: 'https://www.anthropic.com/claude-code', pricing: 'https://claude.com/pricing', docs: 'https://docs.anthropic.com/en/docs/claude-code/overview', summary: 'Anthropic’s coding agent, available through Claude plans and API usage.' },
  { id: 'codex', category: 'code', name: 'OpenAI Codex', domain: 'openai.com', homepage: 'https://openai.com/codex/', pricing: 'https://openai.com/chatgpt/pricing/', docs: 'https://developers.openai.com/codex/', summary: 'OpenAI’s coding agent for delegating and reviewing software tasks.' },
]

export function toTool(service: TopService): Tool {
  return { id: service.id, domain: service.domain, name: service.name, homepageUrl: service.homepage, summary: service.summary, categories: [service.category === 'image' ? 'Image Generation' : service.category === 'video' ? 'Video Generation' : 'Code & Dev Tools'], coverUrl: `https://${service.domain}/favicon.ico`, pricing: null }
}
