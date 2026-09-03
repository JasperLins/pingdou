import { Outlet } from 'react-router-dom'
import { Seo } from '@/components/Seo'
import { ThemeController } from '@/components/ThemeController'

/** 全路由共享外壳：主题同步 + 路由级 SEO。 */
export function AppShell() {
  return (
    <>
      <ThemeController />
      <Seo />
      <Outlet />
    </>
  )
}
