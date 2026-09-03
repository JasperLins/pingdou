import { BRAND_INFOS } from '@/lib/palettes';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/project';
import {
  GEN_TYPE_PRESETS,
  TARGET_COLOR_CHIPS,
  TARGET_COLOR_MAX,
  useConvertStore,
  type ConvertParams,
} from '@/store/convert';
import { CUSTOM_SIZE_MAX, CUSTOM_SIZE_MIN } from '../boardSpec';
import { CompareView } from './CompareView';

/**
 * 参数步（design.md §3）：生成类型三卡（预设联动、可全量覆盖）+
 * 尺寸档位/自定义、targetColors 档位 chips + 自由输入、平滑/卡通、
 * 亮度/对比度/饱和度、去背景容差 + 实时对照（CompareView）。
 * 直映类型下尺寸由源图网格决定，尺寸面板替换为识别结果信息。
 */

const SIZE_CHIPS: readonly number[] = [29, 52, 58, 87, 104];

export function ConfigStep() {
  const params = useConvertStore((s) => s.params);
  const sourceType = useConvertStore((s) => s.sourceType);
  const photoLike = useConvertStore((s) => s.photoLike);
  const result = useConvertStore((s) => s.result);
  const error = useConvertStore((s) => s.error);
  const applyGenType = useConvertStore((s) => s.applyGenType);
  const setParams = useConvertStore((s) => s.setParams);
  const brandKey = useProjectStore((s) => s.brandKey);
  const loaded = useProjectStore((s) => s.loaded);

  const isDirect = sourceType !== 'photo';
  const preset = GEN_TYPE_PRESETS.find((p) => p.key === params.genType);
  const sizeValid = params.targetSize >= CUSTOM_SIZE_MIN && params.targetSize <= CUSTOM_SIZE_MAX;
  const outOfPreset = preset !== undefined && (params.targetSize < preset.minSize || params.targetSize > preset.maxSize);
  const colorsValid = params.targetColors >= 0 && params.targetColors <= TARGET_COLOR_MAX;
  const qPhotoAdvice = params.genType === 'q' && photoLike && sourceType === 'photo';

  return (
    <div className="space-y-4">
      {/* 生成类型三卡 */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-ink">生成类型（预设只是起点，参数随意改）</legend>
        <div className="grid grid-cols-3 gap-2">
          {GEN_TYPE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={params.genType === p.key}
              onClick={() => applyGenType(p.key)}
              className={cn(
                'rounded-2xl border-2 px-3 py-2.5 text-left transition-all',
                params.genType === p.key
                  ? 'border-primary bg-primaryFaint'
                  : 'border-line bg-surface hover:border-primary/60',
              )}
            >
              <span className="block text-sm font-bold text-ink">{p.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-inkSoft">{p.tagline}</span>
              <span className="mt-1 block text-[10px] text-inkSoft">
                {p.minSize}–{p.maxSize} 档 · {p.defaultTargetColors === 0 ? '不限色' : `${p.defaultTargetColors} 色`}
                {p.mode === 'cartoon' ? ' · 卡通' : ' · 平滑'}
              </span>
            </button>
          ))}
        </div>
        {qPhotoAdvice && (
          <p className="mt-1.5 rounded-full bg-primaryFaint px-3.5 py-1.5 text-[11px] font-semibold text-primaryStrong">
            这张看起来是写实照片，Q版会丢很多细节——建议改用「写真」，或先回上一步裁剪主体。
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 目标尺寸（直映时不适用） */}
        {!isDirect ? (
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-ink">目标尺寸（正方形格数）</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {SIZE_CHIPS.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={params.targetSize === size}
                  onClick={() => setParams({ targetSize: size })}
                  className={cn(
                    'rounded-full border-2 px-3 py-1 text-xs font-bold transition-all',
                    params.targetSize === size
                      ? 'border-primary bg-primaryFaint text-primaryStrong'
                      : 'border-line bg-surface text-ink hover:border-primary/60',
                  )}
                >
                  {size}
                </button>
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-[11px] text-inkSoft">
                自定义
                <input
                  type="number"
                  min={CUSTOM_SIZE_MIN}
                  max={CUSTOM_SIZE_MAX}
                  value={params.targetSize}
                  onChange={(e) => setParams({ targetSize: Math.round(Number(e.target.value)) })}
                  aria-label="自定义边长（7–104）"
                  className={cn(
                    'w-16 rounded-full border-2 bg-surface px-2.5 py-1 text-xs font-bold text-ink outline-none focus:border-primary',
                    sizeValid ? 'border-line' : 'border-primaryStrong',
                  )}
                />
              </label>
            </div>
            {!sizeValid && (
              <p className="mt-1 text-[11px] font-semibold text-primaryStrong">
                边长需在 {CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX} 之间
              </p>
            )}
            {outOfPreset && sizeValid && (
              <p className="mt-1 text-[11px] text-inkSoft">
                超出{preset?.label}建议区间 {preset?.minSize}–{preset?.maxSize}（可以继续，类型只是起点）。
              </p>
            )}
          </fieldset>
        ) : (
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-ink">目标尺寸</legend>
            <div className="rounded-2xl bg-surface2 px-3.5 py-2.5 text-[11px] leading-snug text-inkSoft">
              {sourceType === 'pixelArt' ? '像素画' : '拼豆图纸'}直映：网格由源图决定
              {result
                ? `，已识别 ${result.w}×${result.h} 格（共 ${result.w * result.h} 格）`
                : error
                  ? '，网格识别失败，请检查裁剪框或改用「普通图片」'
                  : '，正在识别…'}
            </div>
          </fieldset>
        )}

        {/* 目标色数 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">目标色数（0 = 不限）</legend>
          <div className="flex flex-wrap items-center gap-1.5">
            {TARGET_COLOR_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={params.targetColors === n}
                onClick={() => setParams({ targetColors: n })}
                className={cn(
                  'rounded-full border-2 px-3 py-1 text-xs font-bold transition-all',
                  params.targetColors === n
                    ? 'border-primary bg-primaryFaint text-primaryStrong'
                    : 'border-line bg-surface text-ink hover:border-primary/60',
                )}
              >
                {n === 0 ? '不限' : n}
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={TARGET_COLOR_MAX}
              value={params.targetColors}
              onChange={(e) => setParams({ targetColors: Math.max(0, Math.min(TARGET_COLOR_MAX, Math.round(Number(e.target.value)))) })}
              aria-label="自定义色数"
              className={cn(
                'ml-1 w-16 rounded-full border-2 bg-surface px-2.5 py-1 text-xs font-bold text-ink outline-none focus:border-primary',
                colorsValid ? 'border-line' : 'border-primaryStrong',
              )}
            />
          </div>
          <p className="mt-1 text-[11px] text-inkSoft">色板子集聚类，超出部分自动并入最近色。</p>
        </fieldset>

        {/* 风格 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">风格{isDirect && '（直映模式不生效）'}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['cartoon', 'smooth'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={params.mode === mode}
                onClick={() => setParams({ mode })}
                className={cn(
                  'rounded-2xl border-2 px-3 py-2 text-center text-xs font-bold transition-all',
                  params.mode === mode
                    ? 'border-primary bg-primaryFaint text-primaryStrong'
                    : 'border-line bg-surface text-ink hover:border-primary/60',
                )}
              >
                {mode === 'cartoon' ? '卡通（保硬边）' : '平滑（渐变友好）'}
              </button>
            ))}
          </div>
          {/* 品牌锁定说明 */}
          <p className="mt-2 rounded-full bg-surface2 px-3.5 py-1.5 text-[11px] text-inkSoft">
            品牌：{BRAND_INFOS[brandKey].label}
            {loaded ? '（跟随当前工程锁定；要换品牌请先进编辑器用品牌映射）' : '（默认，进编辑器后可跨品牌映射）'}
          </p>
        </fieldset>

        {/* 调节 + 去背景 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">画面调节</legend>
          <div className="space-y-2">
            {(
              [
                ['brightness', '亮度'],
                ['contrast', '对比度'],
                ['saturation', '饱和度'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className="w-12 shrink-0 text-[11px] font-bold text-ink">{label}</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={5}
                  value={params[key]}
                  onChange={(e) => setParams({ [key]: Number(e.target.value) } as Partial<ConvertParams>)}
                  onDoubleClick={() => setParams({ [key]: 0 } as Partial<ConvertParams>)}
                  aria-label={`${label}调节`}
                  className="h-2 flex-1 cursor-pointer accent-primary"
                />
                <span className="w-9 shrink-0 text-right text-[11px] font-bold text-ink">{params[key]}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 pt-1">
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-ink">
                <input
                  type="checkbox"
                  checked={params.removeBackground}
                  onChange={(e) => setParams({ removeBackground: e.target.checked })}
                  className="h-3.5 w-3.5 accent-primary"
                />
                移除纯色背景
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={params.bgTolerance}
                disabled={!params.removeBackground}
                onChange={(e) => setParams({ bgTolerance: Number(e.target.value) })}
                aria-label="背景容差（色差单位）"
                className="h-2 flex-1 cursor-pointer accent-primary disabled:opacity-40"
              />
              <span className="w-14 shrink-0 text-right text-[11px] font-bold text-ink">容差 {params.bgTolerance}</span>
            </div>
          </div>
        </fieldset>
      </div>

      <CompareView />
    </div>
  );
}
