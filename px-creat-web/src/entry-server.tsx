import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/AppRoutes'
import { PRERENDER_ROUTES, RouteSeo, seoForPath, seoHeadTags } from '@/router/seo'

export { PRERENDER_ROUTES, seoHeadTags }

export interface RenderResult {
  /** 路由组件渲染出的静态 HTML 片段（注入 #root 内部） */
  html: string
  title: string
  /** 注入 </head> 前的 meta/OG 标签串 */
  headTags: string
}

/** 预渲染入口：Node 环境把指定 URL 渲染为静态字符串（scripts/prerender.mjs 调用）。 */
export function render(url: string): RenderResult {
  const html = renderToString(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  )
  const seo: RouteSeo = seoForPath(url)
  return { html, title: seo.title, headTags: seoHeadTags(seo) }
}
