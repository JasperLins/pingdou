import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PixelHeart } from '@/components/layout/Header'

/**
 * 编辑器占位页（CSR，不预渲染）。
 * CanvasStage / ToolRail / PalettePanel / StatsPanel 等 components/editor/ 组件在 m2 任务落地。
 */
export function Studio() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-alt px-4">
      <Card className="w-full max-w-md space-y-5 text-center">
        <PixelHeart className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-2xl font-extrabold">拼豆编辑器</h1>
        <p className="text-sm leading-relaxed text-inkSoft">
          精修编辑器（画布、色板、烫染预览、导出三件套）将在 M2–M5 里程碑落地。
          <br />
          当前为工程骨架占位页。
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/">
            <Button variant="soft">返回首页</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
