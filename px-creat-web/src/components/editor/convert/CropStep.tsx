import { useRef } from 'react';
import type { PixelRect } from '@/lib/converter';
import { cn } from '@/lib/utils';
import {
  SUBJECT_SCALE_MAX,
  SUBJECT_SCALE_MIN,
  estimateBeadWidth,
  useConvertStore,
  type SourceType,
} from '@/store/convert';
import { Button } from '@/components/ui/Button';

/**
 * 裁剪步（design.md §1–§2）：8 向手柄裁剪框（拖拽 + 方向键微调）+
 * 主体缩放滑杆 + 源图类型三选 + 「预计约 N 颗宽」实时反馈。
 * 直映类型（像素画/图纸）不参与主体缩放（网格对齐优先）。
 */

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

const HANDLE_POSITIONS: Readonly<Record<Exclude<Handle, 'move'>, string>> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

const SOURCE_TYPE_CARDS: ReadonlyArray<{ key: SourceType; label: string; note: string }> = [
  { key: 'photo', label: '普通图片', note: '照片 / 插画，智能降采样取色' },
  { key: 'pixelArt', label: '像素画', note: '放大过的像素图，按格直映不二次失真' },
  { key: 'beadPattern', label: '拼豆图纸', note: '已有图纸截图，逐格映射最近色号' },
];

export function CropStep() {
  const source = useConvertStore((s) => s.source);
  const crop = useConvertStore((s) => s.crop);
  const subjectScale = useConvertStore((s) => s.subjectScale);
  const sourceType = useConvertStore((s) => s.sourceType);
  const params = useConvertStore((s) => s.params);
  const sourceValidation = useConvertStore((s) => s.sourceValidation);
  const setCrop = useConvertStore((s) => s.setCrop);
  const nudgeCrop = useConvertStore((s) => s.nudgeCrop);
  const setSubjectScale = useConvertStore((s) => s.setSubjectScale);
  const setSourceType = useConvertStore((s) => s.setSourceType);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; rect: PixelRect } | null>(null);

  if (!source) return null;

  const isDirect = sourceType !== 'photo';
  const beads = estimateBeadWidth(params.targetSize, crop.w, source.width);
  const aspect = crop.w / crop.h;
  const aspectWarn = !isDirect && (aspect > 1.08 || aspect < 0.92);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, handle: Handle): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, rect: crop };
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (!drag || !box || box.width === 0) return;
    const scale = box.width / source.width;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const r = drag.rect;
    let { x, y, w, h } = r;
    if (drag.handle === 'move') {
      x = r.x + dx;
      y = r.y + dy;
    } else {
      if (drag.handle.includes('w')) {
        x = r.x + dx;
        w = r.w - dx;
      }
      if (drag.handle.includes('e')) w = r.w + dx;
      if (drag.handle.includes('n')) {
        y = r.y + dy;
        h = r.h - dy;
      }
      if (drag.handle.includes('s')) h = r.h + dy;
    }
    setCrop({ x, y, w, h });
  };

  const endDrag = (): void => {
    dragRef.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = map[event.key];
    if (!delta) return;
    event.preventDefault();
    nudgeCrop(delta[0], delta[1]);
  };

  const pct = (value: number, total: number): string => `${(value / total) * 100}%`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* 裁剪画布 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative inline-block self-center rounded-2xl bg-surface2 p-1.5">
          <div ref={frameRef} className="relative">
            <img
              src={source.dataUrl}
              alt="源图预览"
              draggable={false}
              className="block max-h-[384px] max-w-full select-none rounded-xl"
            />
            {/* 裁剪遮罩 */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-black/35" />
            <div
              role="application"
              aria-label="裁剪框（方向键微调，Shift 加速）"
              tabIndex={0}
              className="absolute cursor-move rounded-lg border-2 border-white/90 shadow-soft-lg outline-none ring-2 ring-primary/60 focus-visible:ring-4"
              style={{
                left: pct(crop.x, source.width),
                top: pct(crop.y, source.height),
                width: pct(crop.w, source.width),
                height: pct(crop.h, source.height),
                backdropFilter: 'brightness(1.35)',
              }}
              onPointerDown={(e) => beginDrag(e, 'move')}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
            >
              {/* 三分构图参考线 */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
              </div>
              {(Object.keys(HANDLE_POSITIONS) as Array<Exclude<Handle, 'move'>>).map((key) => (
                <div
                  key={key}
                  role="separator"
                  aria-label={`裁剪手柄 ${key}`}
                  className={cn(
                    'absolute h-3.5 w-3.5 rounded-full border-2 border-primary bg-white shadow-sticker',
                    HANDLE_POSITIONS[key],
                  )}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    beginDrag(e, key);
                  }}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-inkSoft">
          拖动手柄调整范围 · 拖动框体移动 · 选中框后方向键微调（Shift ×10）
        </p>
      </div>

      {/* 右侧控制列 */}
      <div className="w-full shrink-0 space-y-4 lg:w-72">
        {/* 源图类型三选 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">源图类型</legend>
          <div className="space-y-2">
            {SOURCE_TYPE_CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                aria-pressed={sourceType === card.key}
                onClick={() => setSourceType(card.key)}
                className={cn(
                  'w-full rounded-2xl border-2 px-3.5 py-2 text-left transition-all',
                  sourceType === card.key
                    ? 'border-primary bg-primaryFaint'
                    : 'border-line bg-surface hover:border-primary/60',
                )}
              >
                <span className="block text-sm font-bold text-ink">{card.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-inkSoft">{card.note}</span>
              </button>
            ))}
          </div>
          {isDirect && (
            <p className="mt-1.5 text-[11px] leading-snug text-inkSoft">
              直映模式：网格由源图决定（下一步自动识别），请把裁剪框对齐图案边界，主体缩放不生效。
            </p>
          )}
        </fieldset>

        {/* 主体缩放（仅普通图片） */}
        <fieldset disabled={isDirect}>
          <legend className="mb-1.5 text-xs font-bold text-ink">主体缩放</legend>
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min={SUBJECT_SCALE_MIN}
              max={SUBJECT_SCALE_MAX}
              step={5}
              value={subjectScale}
              disabled={isDirect}
              onChange={(e) => setSubjectScale(Number(e.target.value))}
              onDoubleClick={() => setSubjectScale(100)}
              aria-label="主体缩放百分比"
              className="h-2 w-full cursor-pointer accent-primary disabled:opacity-40"
            />
            <span className="w-12 shrink-0 text-right text-xs font-bold text-ink">{subjectScale}%</span>
          </div>
          <p className="mt-1 text-[11px] text-inkSoft">在裁剪区内推近主体（双击滑杆回到 100%）。</p>
        </fieldset>

        {/* 豆宽预估 */}
        <div className="rounded-2xl bg-surface2 p-3.5 text-xs text-inkSoft">
          <p>
            裁剪框 <b className="text-ink">{Math.round(crop.w)}×{Math.round(crop.h)}</b> 像素 ·{' '}
            {isDirect ? '直映网格下一步识别' : <>按 <b className="text-ink">{params.targetSize}</b> 档预估约 <b className="text-ink">{beads}</b> 颗宽</>}
          </p>
          {aspectWarn && (
            <p className="mt-1 text-primaryStrong">裁剪框宽高比约 {aspect.toFixed(2)}，转图会拉伸为正方形。</p>
          )}
        </div>

        {/* 源图体检提示（权威校验在转换管线，错误码驱动） */}
        {sourceType === 'photo' && sourceValidation && (
          <div className="rounded-2xl border-2 border-primary/40 bg-primaryFaint p-3 text-[11px] leading-snug text-primaryStrong">
            {sourceValidation.message}
            <span className="mt-0.5 block text-inkSoft">若源图本身是像素画/图纸，可选择对应类型直映。</span>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setCrop({ x: 0, y: 0, w: source.width, h: source.height })}
        >
          重置裁剪
        </Button>
      </div>
    </div>
  );
}
