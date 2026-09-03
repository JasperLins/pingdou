import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { PixelHeart } from '@/components/layout/Header'

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-alt px-4">
      <Card className="w-full max-w-md space-y-4 text-center">
        <PixelHeart className="mx-auto h-10 w-10 text-primarySoft" />
        <h1 className="text-4xl font-extrabold text-primaryStrong">404</h1>
        <p className="text-sm text-inkSoft">这颗豆子滚到格子外面去了。</p>
        <Link to="/" className={buttonClass('primary', 'md')}>
          回到首页
        </Link>
      </Card>
    </div>
  )
}
