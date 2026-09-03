import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 轻量 Tooltip：纯 CSS（group-hover / group-focus-within）显示，无 JS 状态。
 * 结构参考 lineone popover/tooltip，视觉走本站 token。
 */
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export interface TooltipProps {
  content: string
  placement?: TooltipPlacement
  children: ReactNode
}

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-bg opacity-0 shadow-sticker transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          PLACEMENT_CLASS[placement],
        )}
      >
        {content}
      </span>
    </span>
  )
}
