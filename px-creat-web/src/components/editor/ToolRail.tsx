import { cn } from '@/lib/utils';
import type { EditorTool } from '@/lib/types';
import { useEditorStore } from '@/store/editor';
import { useProjectStore } from '@/store/project';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * 左侧工具栏：七工具 + 笔刷大小（1–4 方刷）+ 撤销重做（design.md §1）。
 * 快捷键体系见 useEditorShortcuts（B/E/G/I、[ ]、Ctrl+Z/Y、空格平移）。
 */

const TOOLS: { key: EditorTool; label: string; hint: string; icon: React.ReactNode }[] = [
  { key: 'brush', label: '画笔', hint: 'B', icon: <IconPencil /> },
  { key: 'eraser', label: '橡皮', hint: 'E', icon: <IconEraser /> },
  { key: 'bucket', label: '油漆桶', hint: 'G', icon: <IconBucket /> },
  { key: 'line', label: '直线', hint: '', icon: <IconLine /> },
  { key: 'rect', label: '矩形', hint: '', icon: <IconRect /> },
  { key: 'ellipse', label: '椭圆', hint: '', icon: <IconEllipse /> },
  { key: 'picker', label: '吸管', hint: 'I / Alt+点击', icon: <IconPicker /> },
];

export function ToolRail() {
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const setTool = useEditorStore((s) => s.setTool);
  const setBrushSize = useEditorStore((s) => s.setBrushSize);

  return (
    <div className="flex w-14 flex-col items-center gap-1.5 rounded-card bg-surface p-2 shadow-soft">
      {TOOLS.map(({ key, label, hint, icon }) => (
        <Tooltip key={key} content={hint ? `${label}（${hint}）` : label} placement="right">
          <button
            type="button"
            aria-label={label}
            aria-pressed={tool === key}
            onClick={() => setTool(key)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90',
              tool === key
                ? 'bg-primary text-onPrimary shadow-sticker'
                : 'text-inkSoft hover:bg-primaryFaint hover:text-primaryStrong',
            )}
          >
            {icon}
          </button>
        </Tooltip>
      ))}

      <div className="my-1 h-px w-8 bg-line" aria-hidden />

      <div className="flex flex-col items-center gap-1" role="group" aria-label="笔刷大小">
        {[1, 2, 3, 4].map((size) => (
          <Tooltip key={size} content={`${size}×${size} 方刷`} placement="right">
            <button
              type="button"
              aria-label={`笔刷 ${size}`}
              aria-pressed={brushSize === size}
              onClick={() => setBrushSize(size)}
              className={cn(
                'flex h-6 w-10 items-center justify-center rounded-full transition-all active:scale-90',
                brushSize === size ? 'bg-primaryFaint' : 'hover:bg-primaryFaint',
              )}
            >
              <span
                className={cn('rounded-sm', brushSize === size ? 'bg-primary' : 'bg-inkSoft/60')}
                style={{ width: 3 + size * 2.5, height: 3 + size * 2.5 }}
              />
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="my-1 h-px w-8 bg-line" aria-hidden />

      <Tooltip content="撤销（Ctrl+Z）" placement="right">
        <button
          type="button"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={() => useProjectStore.getState().undo()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-inkSoft transition-all hover:bg-primaryFaint hover:text-primaryStrong active:scale-90 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content="重做（Ctrl+Shift+Z / Ctrl+Y）" placement="right">
        <button
          type="button"
          aria-label="重做"
          disabled={!canRedo}
          onClick={() => useProjectStore.getState().redo()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-inkSoft transition-all hover:bg-primaryFaint hover:text-primaryStrong active:scale-90 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H10a6 6 0 0 0 0 12h3" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 线性图标（16–20px 视觉，currentColor）
// ---------------------------------------------------------------------------

function iconProps(): React.SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function IconPencil() {
  return (
    <svg {...iconProps()}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IconEraser() {
  return (
    <svg {...iconProps()}>
      <path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4L13.6 4.4a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4L11 21Z" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

function IconBucket() {
  return (
    <svg {...iconProps()}>
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z" />
      <path d="m5 14 6 6" />
      <path d="M19 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5Z" />
    </svg>
  );
}

function IconLine() {
  return (
    <svg {...iconProps()}>
      <path d="M4 20 20 4" />
      <circle cx="4" cy="20" r="1.6" />
      <circle cx="20" cy="4" r="1.6" />
    </svg>
  );
}

function IconRect() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
  );
}

function IconEllipse() {
  return (
    <svg {...iconProps()}>
      <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />
    </svg>
  );
}

function IconPicker() {
  return (
    <svg {...iconProps()}>
      <path d="m15 3 6 6-2.5 2.5L15 8Z" />
      <path d="M12.5 7.5 4 16v4h4l8.5-8.5Z" />
    </svg>
  );
}
