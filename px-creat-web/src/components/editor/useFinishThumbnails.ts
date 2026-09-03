import { useEffect } from 'react';
import { FINISH_PRESET_KEYS } from '@/lib/finish';
import { useProjectStore } from '@/store/project';
import { useFinishStore } from '@/store/finish';
import {
  buildFinishPaletteData,
  cancelIdle,
  downsampleCells,
  rgbaToDataUrl,
  scheduleIdle,
  thumbVersion,
  defaultFinishRunner,
  type FinishRunner,
} from './finishRender';

/**
 * 预设缩略图缓存（design §4）：面板打开或画布/品牌变化时，空闲期逐个渲染
 * 六预设缩略图（当前作品 ≤24×24 快照 @4px），逐个替换不阻塞 UI。
 * 画布变更 → 指纹不匹配 → 标记过期 → 空闲重算；失败也记指纹防重试风暴。
 */

/** 缩略图快照最大边（格数）。 */
export const THUMB_MAX_SIDE = 24;
/** 缩略图每格像素。 */
export const THUMB_PX_PER_CELL = 4;

export function useFinishThumbnails(runner: FinishRunner = defaultFinishRunner): void {
  const cellsVersion = useProjectStore((s) => s.cellsVersion);
  const w = useProjectStore((s) => s.w);
  const h = useProjectStore((s) => s.h);
  const brandKey = useProjectStore((s) => s.brandKey);
  const loaded = useProjectStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded || w <= 0 || h <= 0) return;
    let cancelled = false;
    const version = thumbVersion(brandKey, cellsVersion);
    const idle = scheduleIdle(() => {
      void (async () => {
        const state = useProjectStore.getState();
        const small = downsampleCells(state.cells, state.w, state.h, THUMB_MAX_SIDE);
        const paletteData = buildFinishPaletteData(state.brandKey);
        // 逐个渲染逐个替换（首开全缩略图 ≤3s 预算；小图单次 ~10ms 级）
        for (const preset of FINISH_PRESET_KEYS) {
          if (cancelled) return;
          const cached = useFinishStore.getState().thumbnails[preset];
          if (cached.version === version && cached.dataUrl) continue;
          try {
            const out = await runner({
              cells: small.cells,
              w: small.w,
              h: small.h,
              paletteData,
              preset,
              intensity: 100,
              pxPerCell: THUMB_PX_PER_CELL,
            });
            if (cancelled) return;
            useFinishStore.getState().setThumb(preset, rgbaToDataUrl(out.rgba, out.w, out.h), version);
          } catch {
            // 失败同样记指纹：占位图顶替，待画布下次变更重试
            if (!cancelled) useFinishStore.getState().setThumb(preset, null, version);
          }
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle(idle);
    };
  }, [loaded, w, h, brandKey, cellsVersion, runner]);
}
