import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/AppRoutes'
import { PRERENDER_ROUTES } from '@/router/seo'
import '@/index.css'

/** 客户端入口：声明式路由（与预渲染入口 entry-server 同构，保证水合一致）；预渲染营销页走 hydrate，其余（studio/dev/直开 SPA）走普通挂载。 */
const container = document.getElementById('root')
if (!container) {
  throw new Error('未找到 #root 挂载点')
}

const app = (
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>
)

// SPA fallback 会用首页 HTML 兜底 studio/404 等路径，此时 #root 非空但内容
// 与当前路由不符，hydrate 会恢复失败；只有真实预渲染路由才可安全水合。
const normalizedPath = location.pathname.replace(/\/+$/, '') || '/'
const isPrerendered = PRERENDER_ROUTES.includes(normalizedPath)

if (isPrerendered && container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
