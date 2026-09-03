import { useEffect, useMemo, useRef } from 'react';
import { toPresetKey } from '@/lib/finish';
import { useProjectStore } from '@/store/project';
import { useFinishStore } from '@/store/finish';
import {
  buildFinishPaletteData,
  previewPxPerCell,
  type FinishRunner,
  defaultFinishRunner,
} from './finishRender';

/**
 * 画布效果预览渲染调度（design §4 / §5）：
 * - 预览态开启时按指纹（cellsVersion+尺寸+品牌+preset+intensity+降级口径）渲染；
 * - 预设切换立即派发（≤1s 预算），强度拖动 150ms 防抖后派发；
 * - 指纹命中缓存（previewKey）直接复用，不重复渲染；
 * - 最新者胜：过期结果丢弃；Worker 故障只清 busy，画布回退平面图。
 */

/** 强度拖动的防抖间隔（ms）。 */
export const INTENSITY_DEBOUNCE_MS = 150;

export function useFinishPreview(runner: FinishRunner = defaultFinishRunner): void {
  const previewing = useFinishStore((s) => s.previewing);
  const finish = useProjectStore((s) => s.finish);
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const w = useProjectStore((s) => s.w);
  const h = useProjectStore((s) => s.h);
  const brandKey = useProjectStore((s) => s.brandKey);
  const loaded = useProjectStore((s) => s.loaded);

  const paletteData = useMemo(() => buildFinishPaletteData(brandKey), [brandKey]);
  const presetKey = toPresetKey(finish.preset);
  const pxPerCell = previewPxPerCell(w, h);
  const key = loaded
    ? JSON.stringify({ v: cellsVersion, w, h, b: brandKey, p: presetKey, i: finish.intensity, s: pxPerCell })
    : null;

  /** 最近一次派发的指纹（判定预设切换是否需要跳过防抖）与最新者胜守卫。 */
  const dispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewing || key === null) return;
    // 指纹命中缓存：复用已有位图（面板重开 / 强度回拨）
    if (useFinishStore.getState().previewKey === key) {
      dispatchedRef.current = key;
      return;
    }
    const prev = dispatchedRef.current;
    dispatchedRef.current = key;
    // 首次派发（prev===null）与预设切换立即渲染；纯强度变化走 150ms 防抖
    const presetChanged = prev === null || JSON.parse(prev).p !== presetKey;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        const state = useProjectStore.getState();
        useFinishStore.getState().setPreviewBusy(true);
        runner({
          cells: state.cells,
          w: state.w,
          h: state.h,
          paletteData,
          preset: presetKey,
          intensity: finish.intensity,
          pxPerCell,
        })
          .then((out) => {
            if (cancelled || dispatchedRef.current !== key) return;
            useFinishStore.getState().setPreview({ rgba: out.rgba, w: out.w, h: out.h }, key);
          })
          .catch(() => {
            // 渲染失败：清 busy 即可，画布显示平面图兜底（不阻塞交互）
            if (!cancelled) useFinishStore.getState().setPreviewBusy(false);
          });
      },
      presetChanged ? 0 : INTENSITY_DEBOUNCE_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewing, key, presetKey, finish.intensity, paletteData, pxPerCell, runner]);
}
