import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * 侧边/底部抽屉：结构参考 lineone drawer，视觉走本站 token。
 * 仅在 open 时渲染，Esc 关闭，锁定背景滚动。
 */
export type DrawerSide = 'left' | 'right' | 'bottom'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: DrawerSide
  title?: string
  children: ReactNode
  className?: string
}

const PANEL_CLASS: Record<DrawerSide, string> = {
  left: 'left-0 top-0 h-full w-80 max-w-[85vw] rounded-r-card animate-slide-in-left',
  right: 'right-0 top-0 h-full w-80 max-w-[85vw] rounded-l-card animate-slide-in-right',
  bottom: 'bottom-0 left-0 right-0 max-h-[75vh] rounded-t-cardLg animate-slide-in-up',
}

export function Drawer({ open, onClose, side = 'right', title, children, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute bg-surface p-6 text-ink shadow-soft-lg outline-none',
          PANEL_CLASS[side],
          className,
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2.5 text-lg font-bold">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-primary" />
              {title}
            </h2>
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="rounded-full p-1.5 text-inkSoft transition-colors hover:bg-primaryFaint hover:text-primaryStrong"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
        <div className="text-sm leading-relaxed text-inkSoft">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
