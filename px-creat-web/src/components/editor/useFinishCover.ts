import { useEffect } from 'react';
import { toPresetKey } from '@/lib/finish';
import { useProjectStore } from '@/store/project';
import { useFinishStore } from '@/store/finish';
import {
  buildFinishPaletteData,
  cancelIdle,
  coverPxPerCell,
  flatPatternDataUrl,
  rgbaToDataUrl,
  scheduleIdle,
  defaultFinishRunner,
  type FinishRunner,
} from './finishRender';

/**
 * 效果封面（F6）：保存动作本身不等待封面（persistNow ≤500ms 返回）；每次保存
 * 落盘后空闲期异步生成全分辨率烫染 PNG，失败降级平面图纸图，再失败保持旧封面
 * ——任何路径都不阻塞保存与交互。封面缓存于会话（分享页 OG 接线属 P1 图库）。
 */
export function useFinishCover(runner: FinishRunner = defaultFinishRunner): void {
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);

  useEffect(() => {
    if (!lastSavedAt) return;
    let cancelled = false;
    const idle = scheduleIdle(() => {
      void (async () => {
        const state = useProjectStore.getState();
        if (!state.loaded) return;
        const key = JSON.stringify([state.cellsVersion, state.w, state.h, state.brandKey, state.finish]);
        if (useFinishStore.getState().cover?.key === key) return;
        const preset = toPresetKey(state.finish.preset);
        try {
          const out = await runner({
            cells: state.cells,
            w: state.w,
            h: state.h,
            paletteData: buildFinishPaletteData(state.brandKey),
            preset,
            intensity: state.finish.intensity,
            pxPerCell: coverPxPerCell(state.w, state.h),
          });
          const dataUrl = rgbaToDataUrl(out.rgba, out.w, out.h);
          if (dataUrl) {
            if (!cancelled) useFinishStore.getState().setCover({ dataUrl, key });
            return;
          }
        } catch {
          // 渲染失败 → 平面图纸降级（下方继续）
        }
        const fallback = flatPatternDataUrl(state.cells, state.w, state.h, state.brandKey);
        if (fallback && !cancelled) useFinishStore.getState().setCover({ dataUrl: fallback, key });
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle(idle);
    };
  }, [lastSavedAt, runner]);
}
