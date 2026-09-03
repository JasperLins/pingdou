import { describe, expect, it } from 'vitest'
import { PRERENDER_ROUTES, SEO_META, seoForPath, seoHeadTags } from '@/router/seo'

describe('路由 SEO 配置', () => {
  it('每个预渲染路由都有完整 meta', () => {
    for (const route of PRERENDER_ROUTES) {
      const seo = SEO_META[route]
      expect(seo, `路由 ${route} 缺少 SEO 配置`).toBeDefined()
      expect(seo.title.length).toBeGreaterThan(0)
      expect(seo.description.length).toBeGreaterThan(0)
    }
  })

  it('未知路径回退到兜底 meta', () => {
    const seo = seoForPath('/not-exist')
    expect(seo.title).toContain('拼豆')
    expect(seo.description.length).toBeGreaterThan(0)
  })

  it('工具页/演示页标记 noindex', () => {
    expect(SEO_META['/studio'].robots).toContain('noindex')
    expect(SEO_META['/dev/ui'].robots).toContain('noindex')
  })

  it('head 标签串包含 description 与 OG', () => {
    const tags = seoHeadTags(seoForPath('/'))
    expect(tags).toContain('name="description"')
    expect(tags).toContain('property="og:title"')
    expect(tags).toContain('property="og:image"')
    expect(tags).toContain('/og-default.png')
  })

  it('head 标签串转义特殊字符', () => {
    const tags = seoHeadTags({ title: 'a<b', description: 'c"d' })
    expect(tags).toContain('a&lt;b')
    expect(tags).toContain('c&quot;d')
  })
})
