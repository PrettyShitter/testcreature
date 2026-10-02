import { describe, expect, it } from 'vitest'
import { dedupe, normalize } from './api'

describe('FreeSERP records', () => {
  it('normalizes the documented fields and attaches checked metadata by domain', () => {
    const tool = normalize({
      domain: 'openart.ai', url: 'https://openart.ai', title: 'OpenArt: AI Image Generator',
      ai_summary: 'Create images and videos.', ai_categories: ['Image Generation', 'Video Generation'],
    })
    expect(tool).toMatchObject({
      id: 'openart.ai', name: 'OpenArt', homepageUrl: 'https://openart.ai',
      categories: ['Image Generation', 'Video Generation'], coverUrl: '/logos/openart.png',
    })
    expect(tool?.pricing?.sourceUrl).toBe('https://openart.ai/pricing')
  })

  it('rejects unsupported protocols and a URL whose host differs from the returned domain', () => {
    expect(normalize({ domain: 'example.com', url: 'javascript:alert(1)', title: 'Example' })).toBeNull()
    expect(normalize({ domain: 'example.com', url: 'https://other.example/', title: 'Example' })).toBeNull()
  })

  it('deduplicates records by normalized domain while preserving first-seen order', () => {
    const first = normalize({ domain: 'www.example.com', url: 'https://www.example.com', title: 'First' })!
    const duplicate = normalize({ domain: 'example.com', url: 'https://example.com', title: 'Second' })!
    const other = normalize({ domain: 'other.example', url: 'https://other.example', title: 'Other' })!
    expect(dedupe([first, duplicate, other]).map(tool => tool.name)).toEqual(['First', 'Other'])
  })
})
