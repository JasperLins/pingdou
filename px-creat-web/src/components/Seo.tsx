import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { DEFAULT_OG_IMAGE, SITE_NAME, seoForPath } from '@/router/seo'

/**
 * 路由层 SEO 控制器：按当前路由把 title / description / OG upsert 到 <head>。
 * 预渲染营销页的静态标签由 scripts/prerender.mjs 注入；本组件负责
 * 客户端路由切换时的同步（存在即更新，不存在即创建，避免重复标签）。
 */
export function Seo() {
  const { pathname } = useLocation()
  const seo = seoForPath(pathname)

  useEffect(() => {
    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:type', seo.ogType ?? 'website')
    upsertMeta('property', 'og:image', seo.ogImage ?? DEFAULT_OG_IMAGE)
    if (seo.robots) {
      upsertMeta('name', 'robots', seo.robots)
    } else {
      // noindex 页客户端导航回营销页后，残留的 robots 标签会让爬虫漏收，须移除
      document.head.querySelector('meta[name="robots"]')?.remove()
    }
  }, [seo])

  return null
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
