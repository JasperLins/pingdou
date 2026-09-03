import { useEffect, useRef } from 'react';
import { BRAND_INFOS } from '@/lib/palettes';
import { useProjectStore } from '@/store/project';
import { useConvertStore } from '@/store/convert';
import { ResultCanvas } from './ResultCanvas';

/**
 * 左原图 / 右结果实时对照（design.md §4）：
 * 参数变更 150ms 防抖 → 增量重跑（Worker via converterClient，参数指纹命中跳过）。
 * 左侧原图用 CSS filter 同步预览亮度/对比度/饱和度（与管线语义一致）。
 */
export function CompareView() {
  const work = useConvertStore((s) => s.work);
  const workVersion = useConvertStore((s) => s.workVersion);
  const params = useConvertStore((s) => s.params);
  const sourceType = useConvertStore((s) => s.sourceType);
  const result = useConvertStore((s) => s.result);
  const error = useConvertStore((s) => s.error);
  const busy = useConvertStore((s) => s.busy);
  const runConvert = useConvertStore((s) => s.runConvert);
  const brandKey = useProjectStore((s) => s.brandKey);

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);

  // 左栏：work 像素绘制（调节用 CSS filter 叠加，与 Worker 管线语义一致）
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !work) return;
    canvas.width = work.width;
    canvas.height = work.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(work.data), work.width, work.height), 0, 0);
  }, [work, workVersion]);

  // 右栏：防抖增量重跑（测试环境无 Worker 时跳过，等待注入 runner 的正式转换）
  useEffect(() => {
    if (!work || typeof Worker === 'undefined') return;
    const timer = window.setTimeout(() => {
      void runConvert();
    }, 150);
    return () => window.clearTimeout(timer);
    // runConvert 依赖 store 内的当前态，指纹缓存在 store 侧判定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work, workVersion, params, sourceType]);

  const filter = `brightness(${1 + params.brightness / 100}) contrast(${contrastCss(params.contrast)}) saturate(${1 + params.saturation / 100})`;

  return (
    <div className="grid grid-cols-2 gap-3">
      <figure className="min-w-0">
        <figcaption className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-inkSoft">
          <span>原图{params.brightness || params.contrast || params.saturation ? '（含调节预览）' : ''}</span>
          <span>{work ? `${work.width}×${work.height}px` : ''}</span>
        </figcaption>
        <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-surface2 p-2">
          {work ? (
            <canvas
              ref={sourceCanvasRef}
              aria-label="原图预览"
              className="max-h-full max-w-full rounded-lg object-contain"
              style={{ filter }}
            />
          ) : (
            <span className="text-xs text-inkSoft">无图像</span>
          )}
        </div>
      </figure>

      <figure className="min-w-0">
        <figcaption className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-inkSoft">
          <span>
            {busy && !result ? '转换中…' : '图纸预览'}
            {result && !busy && ` · ${result.w}×${result.h} · 用色 ${result.usedCodes}`}
          </span>
          <span className="ml-2 shrink-0">{BRAND_INFOS[brandKey].label}</span>
        </figcaption>
        <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-surface2 p-2">
          {error ? (
            <p className="px-2 text-center text-[11px] leading-relaxed font-semibold text-primaryStrong">
              {error.message}
            </p>
          ) : result ? (
            <ResultCanvas w={result.w} h={result.h} cells={result.cells} brandKey={brandKey} maxSide={200} />
          ) : (
            <span className="animate-pulse text-xs text-inkSoft">{busy ? '转换中…' : '等待预览'}</span>
          )}
        </div>
      </figure>
    </div>
  );
}

/** -100–100 → CSS contrast 系数（与 lib applyAdjustments 同形）。 */
function contrastCss(contrast: number): number {
  const c = contrast * 2.55;
  return (259 * (c + 255)) / (255 * (259 - c));
}
