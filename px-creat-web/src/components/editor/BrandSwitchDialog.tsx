import { useMemo, useState } from 'react';
import { BRAND_INFOS, findNearestColors, loadPalette } from '@/lib/palettes';
import { BRAND_KEYS, type BrandKey } from '@/lib/types';
import { mapCellsToPalette, replaceColor, type BrandMappingEntry } from '@/lib/cellOps';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

/**
 * 品牌切换对话框（2026-09-04 定案：一键映射 + 角标复查）：
 * 预览源色 → CIEDE2000 最近色映射表 → 一键全量应用（单条 undo）→
 * 色差超阈值的映射进入复查（画布角标 + 明细逐格改）。
 */

/** 色差超过该值的映射标记为「待复查」。 */
const REVIEW_DELTA_E = 10;

/** 复查明细中给出的候选数。 */
const CANDIDATE_COUNT = 6;

export interface BrandSwitchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BrandSwitchDialog({ open, onClose }: BrandSwitchDialogProps) {
  const brandKey = useProjectStore((s) => s.brandKey);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const reviewColors = useEditorStore((s) => s.reviewColors);
  const [target, setTarget] = useState<BrandKey | null>(null);
  const [applied, setApplied] = useState(false);

  const currentPalette = useMemo(() => loadPalette(brandKey), [brandKey]);

  const preview = useMemo(() => {
    if (!target || !open || applied) return null;
    const state = useProjectStore.getState();
    const toPalette = loadPalette(target);
    return mapCellsToPalette(state.cells, currentPalette, toPalette);
    // 打开期间 cells 理论不变（对话框模态），cellsVersion 依赖保证新开时重算
  }, [target, open, applied, currentPalette, cellsVersion]);

  const reset = (): void => {
    setTarget(null);
    setApplied(false);
  };

  const close = (): void => {
    reset();
    onClose();
  };

  const onApply = (): void => {
    if (!target || !preview) return;
    useProjectStore.getState().applyDiff(preview.diff, `切换品牌 → ${BRAND_INFOS[target].label}`, {
      brandSwap: { before: brandKey, after: target },
    });
    useEditorStore
      .getState()
      .setReviewColors(preview.mapping.filter((m) => m.deltaE > REVIEW_DELTA_E).map((m) => m.to));
    setApplied(true);
  };

  const candidatesFor = (colorIdx: number): BrandMappingEntry[] => {
    if (!target) return [];
    const toPalette = loadPalette(target);
    const rgb = toPalette.colors[colorIdx]?.rgb;
    if (!rgb) return [];
    return findNearestColors(toPalette, rgb, CANDIDATE_COUNT + 1)
      .filter((c) => c.index !== colorIdx)
      .map((c) => ({ from: colorIdx, to: c.index, deltaE: c.deltaE, count: 0 }));
  };

  const onRemap = (fromIdx: number, toIdx: number): void => {
    const { cells } = useProjectStore.getState();
    const diff = replaceColor(cells, fromIdx, toIdx);
    if (diff.indices.length > 0) {
      useProjectStore.getState().applyDiff(diff, '映射复查改色');
    }
    useEditorStore.getState().setReviewColors(useEditorStore.getState().reviewColors.filter((i) => i !== fromIdx));
  };

  const others = BRAND_KEYS.filter((k) => k !== brandKey);

  return (
    <Dialog open={open} onClose={close} title="切换品牌色卡" className="max-w-2xl">
      {!applied ? (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-inkSoft">
            一键把已用色号按 CIEDE2000 色差映射到目标品牌最近色；色差较大的映射会打上角标，
            应用后可在明细中逐格改。当前品牌：<span className="font-bold text-ink">{BRAND_INFOS[brandKey].label}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {others.map((key) => {
              const info = BRAND_INFOS[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={target === key}
                  onClick={() => setTarget(key)}
                  className={cn(
                    'rounded-2xl border-2 px-4 py-3 text-left transition-all',
                    target === key ? 'border-primary bg-primaryFaint' : 'border-line bg-surface hover:border-primary/60',
                  )}
                >
                  <span className="block text-sm font-bold text-ink">{info.label}</span>
                  <span className="mt-0.5 block text-[11px] text-inkSoft">{info.sizeNote}</span>
                </button>
              );
            })}
          </div>

          {target && preview && (
            <div className="max-h-72 overflow-y-auto rounded-2xl bg-surface2 p-3">
              <p className="mb-2 text-xs font-bold text-ink">
                映射预览（{preview.mapping.length} 色，{preview.diff.indices.length} 格变更）
              </p>
              <table className="w-full text-xs">
                <tbody>
                  {preview.mapping.map((m) => {
                    const from = currentPalette.colors[m.from];
                    const to = loadPalette(target).colors[m.to];
                    const flagged = m.deltaE > REVIEW_DELTA_E;
                    return (
                      <tr key={m.from} className="border-b border-line/60 last:border-0">
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-4 w-4 rounded"
                              style={{ backgroundColor: `rgb(${from.rgb.r},${from.rgb.g},${from.rgb.b})` }}
                              aria-hidden
                            />
                            <span className="font-bold text-ink">{from.code}</span>
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-inkSoft">→</td>
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-4 w-4 rounded"
                              style={{ backgroundColor: `rgb(${to.rgb.r},${to.rgb.g},${to.rgb.b})` }}
                              aria-hidden
                            />
                            <span className="font-bold text-ink">{to.code}</span>
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-inkSoft">
                          ΔE {m.deltaE.toFixed(1)} · {m.count} 格
                          {flagged && <span className="ml-1.5 rounded-full bg-primaryFaint px-1.5 py-px text-[10px] font-bold text-primaryStrong">复查</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-inkSoft">
            已切换到 <span className="font-bold text-ink">{target ? BRAND_INFOS[target].label : ''}</span>。
            {reviewColors.length > 0
              ? `以下 ${reviewColors.length} 个映射色差较大，画布上已打角标，可逐色改选：`
              : '全部映射色差在可接受范围内，无待复查项。'}
          </p>
          {reviewColors.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {reviewColors.map((colorIdx) => {
                const toPalette = target ? loadPalette(target) : null;
                const color = toPalette?.colors[colorIdx];
                if (!color || !target) return null;
                return (
                  <div key={colorIdx} className="rounded-2xl bg-surface2 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-5 w-5 rounded-md"
                        style={{ backgroundColor: `rgb(${color.rgb.r},${color.rgb.g},${color.rgb.b})` }}
                        aria-hidden
                      />
                      <span className="text-xs font-bold text-ink">
                        {color.code} {color.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {candidatesFor(colorIdx).map((cand) => {
                        const candColor = toPalette.colors[cand.to];
                        return (
                          <button
                            key={cand.to}
                            type="button"
                            title={`${candColor.code} ${candColor.name}（ΔE ${cand.deltaE.toFixed(1)}）`}
                            onClick={() => onRemap(colorIdx, cand.to)}
                            className="h-7 w-7 rounded-lg transition-transform hover:scale-110 active:scale-90"
                            style={{ backgroundColor: `rgb(${candColor.rgb.r},${candColor.rgb.g},${candColor.rgb.b})` }}
                            aria-label={`改为 ${candColor.code}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-3">
        {applied ? (
          <>
            <Button variant="ghost" onClick={() => useEditorStore.getState().setReviewColors([])}>
              清除全部角标
            </Button>
            <Button onClick={close}>完成</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              取消
            </Button>
            <Button onClick={onApply} disabled={!target || !preview || preview.mapping.length === 0}>
              一键应用映射
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
