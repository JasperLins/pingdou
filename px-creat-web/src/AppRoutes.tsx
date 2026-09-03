import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { About } from '@/pages/marketing/About'
import { Home } from '@/pages/marketing/Home'
import { DevUi } from '@/pages/dev/DevUi'
import { Studio } from '@/pages/studio/Studio'
import { NotFound } from '@/pages/NotFound'

/**
 * 全站路由表（唯一来源）：
 * - 客户端入口 main.tsx 用 <BrowserRouter><AppRoutes /></BrowserRouter>（声明式路由）；
 * - 预渲染入口 entry-server.tsx 用 MemoryRouter 包 <AppRoutes /> renderToString。
 * 两端渲染同一棵组件树，保证预渲染产物可被 hydrate。路由分区：marketing（/、/about，可预渲染）/ studio（编辑器 CSR）/ dev（内部演示）。
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<MarketingLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
        </Route>
        <Route path="studio" element={<Studio />} />
        <Route path="dev/ui" element={<DevUi />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
