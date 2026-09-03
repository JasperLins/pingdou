/**
 * 烫染渲染 Worker：单次渲染 ≤1s 红线的执行载体，主线程永不阻塞（§4.6.6）。
 *
 * 与 converter.worker.ts 同模式：lib/ 中唯一允许使用浏览器 Worker 运行时的
 * 文件（局部接口声明，不引入 WebWorker lib）。管线逻辑全部复用 ./finish 纯函数。
 * 浏览器调用请使用 ./finishClient.ts 的 Promise 封装。
 *
 * 协议：请求 {cells, w, h, paletteData, preset, intensity, pxPerCell} →
 * 响应 ok 时回传 rgba（buffer transfer）+ w/h，失败回传 message。
 * 输入 cells 走结构化克隆拷贝（postMessage 默认复制，不转移调用方缓冲）。
 */

import { renderFinish, type FinishPaletteData, type FinishOutput, type FinishInput } from './finish';
import type { FinishPreset } from './types';

/** Worker 请求。 */
export interface FinishWorkerRequest {
  cells: Int16Array;
  w: number;
  h: number;
  paletteData: FinishPaletteData;
  preset: FinishPreset;
  intensity: number;
  pxPerCell?: number;
}

/** Worker 响应。 */
export type FinishWorkerResponse =
  | ({ ok: true } & FinishOutput)
  | { ok: false; message: string };

/** Worker 线程上下文（DedicatedWorkerGlobalScope 的最小结构声明，避免 lib 冲突）。 */
interface WorkerSelf {
  onmessage: ((event: MessageEvent<FinishWorkerRequest>) => void) | null;
  postMessage(message: FinishWorkerResponse, transfer?: Transferable[]): void;
}

const ctx = self as unknown as WorkerSelf;

ctx.onmessage = (event: MessageEvent<FinishWorkerRequest>): void => {
  const req = event.data;
  try {
    const input: FinishInput = {
      cells: req.cells,
      w: req.w,
      h: req.h,
      paletteData: req.paletteData,
      preset: req.preset,
      intensity: req.intensity,
      ...(req.pxPerCell !== undefined ? { pxPerCell: req.pxPerCell } : {}),
    };
    const out = renderFinish(input);
    ctx.postMessage({ ok: true, rgba: out.rgba, w: out.w, h: out.h }, [out.rgba.buffer]);
  } catch (err) {
    ctx.postMessage({
      ok: false,
      message: `烫染渲染线程异常：${err instanceof Error ? err.message : String(err)}`,
    });
  }
};
