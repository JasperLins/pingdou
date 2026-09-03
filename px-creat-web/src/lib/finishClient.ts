/**
 * 烫染渲染 Worker 的 Promise 调用封装（浏览器专用：Worker API 属 DOM 运行时）。
 *
 * 模式对齐 ./converterClient：每次调用 spawn 一个 module Worker，结果回传后
 * terminate。输入 cells 走结构化克隆（postMessage 默认复制），调用方数据不被
 * 转移；输出 rgba 缓冲由 Worker 转移而来，归调用方所有。
 * 管线单测请直接测 ./finish 纯函数，本文件不做 Vitest 覆盖。
 */

import type { FinishPaletteData } from './finish';
import type { FinishOutput } from './finish';
import type { FinishPreset } from './types';

/** Worker 无响应的兜底超时（ms；全分辨率封面渲染放宽于交互预览）。 */
const WORKER_TIMEOUT_MS = 30_000;

/**
 * 在 Worker 中执行烫染渲染。
 *
 * @param cells 色板下标数组（只读，缓冲会被复制）
 * @param w 网格宽（格数）
 * @param h 网格高（格数）
 * @param paletteData 色板渲染数据（rgbs 平铺三元组 + lum）
 * @param preset 烫染预设（P2 键回退 normal）
 * @param intensity 强度 0–100
 * @param pxPerCell 每格输出像素（缺省 8；预览降级传更小值）
 * @returns RGBA 像素 + 尺寸；Worker 故障时 reject
 */
export function runFinishInWorker(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  paletteData: FinishPaletteData,
  preset: FinishPreset,
  intensity: number,
  pxPerCell?: number,
): Promise<FinishOutput> {
  return new Promise<FinishOutput>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./finish.worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('烫染渲染线程不可用'));
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('finish worker timeout'));
    }, WORKER_TIMEOUT_MS);
    const finish = (fn: () => void): void => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    worker.onmessage = (event: MessageEvent<FinishOutput>) => finish(() => resolve(event.data));
    worker.onerror = (event: ErrorEvent) =>
      finish(() => reject(new Error(event.message || 'finish worker failed')));

    worker.postMessage(
      {
        cells,
        w,
        h,
        paletteData,
        preset,
        intensity,
        ...(pxPerCell !== undefined ? { pxPerCell } : {}),
      },
    );
  });
}
