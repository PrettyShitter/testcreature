import { expect, test } from '@playwright/test'

const all = Array.from({ length: 30 }, (_, i) => record(`tool-${i}.example`, `AI Tool ${i}`, ['AI Agents & Autonomous']))
const image = [record('openart.ai', 'OpenArt: AI Image Generator', ['Image Generation']), record('pixlr.com', 'Pixlr: AI Image Generator', ['Image Generation'])]
const video = [record('synthesia.io', 'Synthesia: AI Video Platform', ['Video Generation']), record('heygen.com', 'HeyGen: AI Video Generator', ['Video Generation'])]
const code = [record('v0.app', 'v0 by Vercel - Build apps', ['Code & Dev Tools'])]

function record(domain: string, title: string, categories: string[]) {
  return { domain, title, url: `https://${domain}`, ai_summary: `${title} helps users create with AI.`, ai_categories: categories }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/freeserp?*', async route => {
    const params = new URL(route.request().url()).searchParams
    const selected = params.get('ai_categories')
    let results = selected === 'Image Generation' ? image : selected === 'Video Generation' ? video : selected === 'Code & Dev Tools' ? code : all
    const query = params.get('q')?.toLowerCase()
    if (query && params.get('size') !== '100') results = results.filter(item => `${item.domain} ${item.title}`.toLowerCase().includes(query))
    const from = Number(params.get('from') ?? 0)
    const size = Number(params.get('size') ?? 24)
    await route.fulfill({ json: { ok: true, index: 'sites', total: results.length, count: Math.min(size, Math.max(0, results.length - from)), from, size, filters: { real_site: '1', ai_startups: true, ...(selected ? { ai_categories: selected } : {}) }, results: results.slice(from, from + size) } })
  })
  await page.goto('/')
  await expect(page.locator('.tool-card').first()).toBeVisible()
})

test('loads exactly three recommendations and a live-shaped catalog page', async ({ page }) => {
  await expect(page.locator('.recommend-main')).toHaveCount(3)
  await expect(page.locator('.tool-card')).toHaveCount(24)
  await expect(page.getByRole('tab', { name: 'Все AI' })).toHaveAttribute('aria-selected', 'true')
})

test('category and search filter results and update the URL', async ({ page }) => {
  await page.getByRole('tab', { name: 'Изображения' }).click()
  await expect(page).toHaveURL(/category=image/)
  await expect(page.locator('.tool-card')).toHaveCount(2)
  await expect(page.locator('.tool-card-category').first()).toHaveText('Image Generation')
  await page.getByRole('textbox', { name: 'Найти AI-инструмент' }).fill('OpenArt')
  await expect(page).toHaveURL(/q=OpenArt/)
  await expect(page.locator('.tool-card')).toHaveCount(1)
  await page.goBack()
  await expect(page.getByRole('textbox', { name: 'Найти AI-инструмент' })).toHaveValue('')
  await expect(page.locator('.tool-card')).toHaveCount(2)
})

test('keyboard activation pins the pricing dialog and Escape returns focus', async ({ page }) => {
  const card = page.locator('.recommend-main').first()
  await card.focus()
  await card.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog).toContainText('Проверено')
  await expect(dialog).toContainText('Starter')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(card).toBeFocused()
})

test('load more appends the next API page without duplicates', async ({ page }) => {
  await page.getByRole('button', { name: /Показать ещё/ }).click()
  await expect(page.locator('.tool-card')).toHaveCount(30)
  const domains = await page.locator('.tool-card').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-domain')))
  expect(new Set(domains).size).toBe(30)
})

test('responsive widths fit the viewport and save layout screenshots', async ({ page }) => {
  const { mkdirSync } = await import('node:fs')
  mkdirSync('artifacts/screenshots', { recursive: true })
  for (const width of [320, 390, 768, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 })
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, columns: getComputedStyle(document.querySelector('.tool-grid')!).gridTemplateColumns.split(' ').length }))
    expect(metrics.overflow, `horizontal overflow at ${width}px`).toBe(false)
    if (width === 1920) expect(metrics.columns).toBe(6)
    if (width === 2560) expect(metrics.columns).toBe(8)
    await page.screenshot({ path: `artifacts/screenshots/${width}.png`, fullPage: true })
  }
})
