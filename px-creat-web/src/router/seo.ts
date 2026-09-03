import { escapeHtml } from '@/lib/utils';

/**
 * 路由级 SEO 配置 —— 全站 title / description / OG 的唯一来源。
 * - 客户端：src/components/Seo.tsx 按 useLocation 读取并 upsert 到 <head>；
 * - 构建：scripts/prerender.mjs 经 entry-server 读取，为营销页写入静态 HTML。
 */

export const SITE_NAME = '拼豆 PinDou'

export const DEFAULT_OG_IMAGE = '/og-default.png'

export interface RouteSeo {
  /** 完整 <title> 文案 */
  title: string
  description: string
  /** Open Graph 类型，默认 website */
  ogType?: 'website' | 'article' | 'profile'
  ogImage?: string
  /** 需要屏蔽索引的路由（工具页/内部页） */
  robots?: string
}

export const SEO_META: Record<string, RouteSeo> = {
  '/': {
    title: '拼豆 PinDou · 把想象拼成图纸',
    description:
      '浏览器里的拼豆创作工坊：图片转图纸、像素画布精修、烫染效果预览与 BOM 导出，五品牌 1,386 色，全流程免费。', 
    ogType: 'website',
  },
  '/about': {
    title: '关于拼豆 PinDou · 创作工坊的故事',
    description:
      '了解拼豆 PinDou 的三类创作入口、五品牌色号系统、烫染预览与导出三件套——为拼豆玩家打造的纯前端创作工具。',
    ogType: 'website',
  },
  '/studio': {
    title: '拼豆编辑器 · PinDou Studio',
    description: '拼豆图纸精修编辑器（客户端应用，无需索引）。',
    robots: 'noindex, nofollow',
  },
  '/dev/ui': {
    title: '组件演示 · PinDou Dev',
    description: '内部 UI 组件演示页。',
    robots: 'noindex, nofollow',
  },
}

/** 预渲染路由（营销页），构建产物必须包含其静态 HTML。 */
export const PRERENDER_ROUTES: readonly string[] = ['/', '/about']

const FALLBACK_SEO: RouteSeo = {
  title: `${SITE_NAME} · 拼豆图纸创作工坊`,
  description: '浏览器里的拼豆创作工坊：图片转图纸、精修编辑、烫染预览与 BOM 导出。',
}

export function seoForPath(pathname: string): RouteSeo {
  return SEO_META[pathname] ?? FALLBACK_SEO
}

/** 生成 <head> 静态 meta 标签串（预渲染脚本注入用）。 */
export function seoHeadTags(seo: RouteSeo): string {
  const ogImage = seo.ogImage ?? DEFAULT_OG_IMAGE
  const tags = [
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:type" content="${escapeHtml(seo.ogType ?? 'website')}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
  ]
  if (seo.robots) {
    tags.push(`<meta name="robots" content="${escapeHtml(seo.robots)}" />`)
  }
  return tags.join('\n    ')
}
