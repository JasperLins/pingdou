import {
  ReactNode,
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  KeyboardEvent,
} from 'react'
import { cn } from '@/lib/utils'

/**
 * pill 分段式 Tabs：结构参考 lineone components-tab，视觉走本站 token。
 * 支持非受控（defaultValue）与受控（value + onValueChange）；方向键在触发器间移动。
 */

interface TabsContextValue {
  value: string
  setValue: (v: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> 必须包裹在 <Tabs> 内使用`)
  return ctx
}

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [inner, setInner] = useState(defaultValue ?? '')
  const current = value ?? inner
  const baseId = useId()
  const setValue = (v: string): void => {
    setInner(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value: current, setValue, baseId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const triggers = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    )
    if (triggers.length === 0) return
    const idx = triggers.indexOf(document.activeElement as HTMLButtonElement)
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = triggers[(idx + dir + triggers.length) % triggers.length]
    next.focus()
    next.click()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-surface2 p-1.5 shadow-sticker',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: current, setValue, baseId } = useTabsContext('TabsTrigger')
  const active = current === value
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
        active
          ? 'bg-primary text-onPrimary shadow-sticker'
          : 'text-inkSoft hover:bg-primaryFaint hover:text-primaryStrong',
        className,
      )}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: current, baseId } = useTabsContext('TabsContent')
  if (current !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('animate-fade-in pt-4', className)}
    >
      {children}
    </div>
  )
}
