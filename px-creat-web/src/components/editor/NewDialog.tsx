import { useMemo, useState } from 'react';
import { BRAND_INFOS } from '@/lib/palettes';
import type { BrandKey } from '@/lib/types';
import { useProjectStore, type BeadSpec } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import {
  BOARD_PRESETS,
  CUSTOM_SIZE_MAX,
  CUSTOM_SIZE_MIN,
  NEW_DIALOG_BRANDS,
  boardDisableReason,
  boardCoverage,
  brandSupportsSpec,
  physicalCm,
  type BoardPreset,
} from './boardSpec';

/**
 * 新建项目对话框：规格（5mm/2.6mm）↔ 板型档位联动禁用提示 +
 * 品牌五选卡（规格不匹配的品牌联动禁用）+ 自定义 7–104 正方形 +
 * cm 物理尺寸与板数实时显示。创建后品牌锁定（切换走 BrandSwitchDialog）。
 */
export interface NewDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewDialog({ open, onClose }: NewDialogProps) {
  const [spec, setSpec] = useState<BeadSpec>('5mm');
  const [size, setSize] = useState(29);
  const [customSize, setCustomSize] = useState(52);
  const [brand, setBrand] = useState<BrandKey>('mard');
  const [title, setTitle] = useState('');

  const effectiveSize = size === -1 ? customSize : size;
  const cm = physicalCm(effectiveSize, spec);
  const coverage = boardCoverage(effectiveSize, effectiveSize, spec);
  const customInvalid = customSize < CUSTOM_SIZE_MIN || customSize > CUSTOM_SIZE_MAX;

  const presets: { preset: BoardPreset; disabled: string | null }[] = useMemo(
    () => BOARD_PRESETS.map((preset) => ({ preset, disabled: boardDisableReason(preset, spec) })),
    [spec],
  );

  const onCreate = (): void => {
    if (customInvalid) return;
    useProjectStore.getState().newProject({
      title: title.trim() === '' ? `未命名作品（${effectiveSize}×${effectiveSize}）` : title.trim(),
      brandKey: brand,
      spec,
      size: effectiveSize,
    });
    useEditorStore.getState().resetEditor();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="新建拼豆作品" className="max-w-lg">
      <div className="space-y-5">
        {/* 标题 */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-ink">作品名称（可留空）</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：星之卡比钥匙扣"
            className="w-full rounded-full border-2 border-line bg-surface px-4 py-2 text-sm text-ink outline-none transition-colors placeholder:text-inkSoft/70 focus:border-primary"
          />
        </label>

        {/* 规格 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">豆子规格</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['5mm', '2.6mm'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={spec === s}
                onClick={() => {
                  setSpec(s);
                  if (!brandSupportsSpec(brand, s)) setBrand('mard');
                  // 当前板型档位不兼容新规格时，回退到该规格的首个可用档位
                  if (size !== -1 && boardDisableReason(
                    BOARD_PRESETS.find((p) => p.size === size) as BoardPreset,
                    s,
                  )) {
                    const first = BOARD_PRESETS.find((p) => p.specs.includes(s));
                    setSize(first ? first.size : -1);
                  }
                }}
                className={cn(
                  'rounded-2xl border-2 px-4 py-3 text-left transition-all',
                  spec === s ? 'border-primary bg-primaryFaint' : 'border-line bg-surface hover:border-primary/60',
                )}
              >
                <span className="block text-sm font-bold text-ink">{s}（{s === '5mm' ? '标准' : '迷你'}）</span>
                <span className="mt-0.5 block text-[11px] text-inkSoft">
                  {s === '5mm' ? '大作品更省力，主流规格' : '细节表现力强，格更密'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* 板型档位 */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">板型（正方形）</legend>
          <div className="grid grid-cols-3 gap-2">
            {presets.map(({ preset, disabled }) => (
              <button
                key={preset.size}
                type="button"
                disabled={disabled !== null}
                aria-pressed={size === preset.size}
                title={disabled ?? preset.note}
                onClick={() => setSize(preset.size)}
                className={cn(
                  'rounded-2xl border-2 px-3 py-2.5 text-center transition-all',
                  size === preset.size && disabled === null
                    ? 'border-primary bg-primaryFaint'
                    : 'border-line bg-surface hover:border-primary/60',
                  disabled !== null && 'cursor-not-allowed opacity-40 hover:border-line',
                )}
              >
                <span className="block text-sm font-bold text-ink">{preset.label}</span>
                <span className="mt-0.5 block text-[11px] text-inkSoft">{preset.note}</span>
                {disabled !== null && <span className="mt-1 block text-[10px] leading-tight text-inkSoft">{disabled}</span>}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={size === -1}
              onClick={() => setSize(-1)}
              className={cn(
                'rounded-2xl border-2 px-3 py-2.5 text-center transition-all',
                size === -1 ? 'border-primary bg-primaryFaint' : 'border-line bg-surface hover:border-primary/60',
              )}
            >
              <span className="block text-sm font-bold text-ink">自定义</span>
              <span className="mt-0.5 block text-[11px] text-inkSoft">
                {CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX} 正方形
              </span>
            </button>
          </div>
          {size === -1 && (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={CUSTOM_SIZE_MIN}
                max={CUSTOM_SIZE_MAX}
                value={customSize}
                onChange={(e) => setCustomSize(Math.round(Number(e.target.value)))}
                aria-label="自定义边长"
                className="w-24 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-bold text-ink outline-none focus:border-primary"
              />
              <span className="text-xs text-inkSoft">格边长（{CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX}）</span>
              {customInvalid && <span className="text-xs font-semibold text-primaryStrong">超出范围</span>}
            </div>
          )}
        </fieldset>

        {/* 品牌选择（五品牌，规格不匹配联动禁用） */}
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold text-ink">品牌色卡（创建后锁定，可跨品牌映射切换）</legend>
          <div className="grid grid-cols-3 gap-2">
            {NEW_DIALOG_BRANDS.map((key) => {
              const info = BRAND_INFOS[key];
              const disabled = !brandSupportsSpec(key, spec);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={brand === key}
                  title={disabled ? `${info.label} 不支持 ${spec}` : info.sizeNote}
                  onClick={() => setBrand(key)}
                  className={cn(
                    'rounded-2xl border-2 px-3 py-2.5 text-center transition-all',
                    brand === key && !disabled ? 'border-primary bg-primaryFaint' : 'border-line bg-surface hover:border-primary/60',
                    disabled && 'cursor-not-allowed opacity-40 hover:border-line',
                  )}
                >
                  <span className="block text-sm font-bold text-ink">{info.label}</span>
                  <span className="mt-0.5 block text-[11px] text-inkSoft">{info.sizeNote}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 实时规格反馈 */}
        <div className="rounded-2xl bg-surface2 p-3.5 text-xs text-inkSoft">
          <p>
            <span className="font-bold text-ink">{effectiveSize}×{effectiveSize}</span> 格 · {spec} ·
            物理尺寸 <span className="font-bold text-ink">{cm}×{cm} cm</span> ·
            约 <span className="font-bold text-ink">{coverage.total}</span> 块板（{coverage.cols}×{coverage.rows}）
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={onCreate} disabled={customInvalid}>
          开始创作
        </Button>
      </div>
    </Dialog>
  );
}
