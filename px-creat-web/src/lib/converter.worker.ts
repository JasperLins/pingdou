/**
 * 转换 Worker：大图转换（如 104×104 目标网格）不在主线程执行（§4.10 性能红线）。
 *
 * 本文件是 lib/ 中唯一允许使用浏览器 Worker 运行时的文件（通过局部接口声明，
 * 不引入 WebWorker lib）。管线逻辑全部复用 ./converter 纯函数。
 * 经 browser 调用请使用 ./converterClient.ts 的 Promise 封装。
 */

import {
  convertImage,
  mapPixelGrid,
  type ConvertOptions,
  type ConvertResult,
  type ConvertSourceType,
} from './converter';
import { loadPalette } from './palettes';
import type { BrandKey } from './types';

/** Worker 请求：像素缓冲 + 转换参数。 */
export interface ConvertWorkerRequest {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  targetW: number;
  targetH: number;
  brandKey: BrandKey;
  options?: ConvertOptions;
  /** 源图类型（缺省 photo 走降采样管线；pixelArt/beadPattern 走按格直映）。 */
  sourceType?: ConvertSourceType;
}

/** Worker 线程上下文（DedicatedWorkerGlobalScope 的最小结构声明，避免 lib 冲突）。 */
interface WorkerSelf {
  onmessage: ((event: MessageEvent<ConvertWorkerRequest>) => void) | null;
  postMessage(message: ConvertResult, transfer?: Transferable[]): void;
}

const ctx = self as unknown as WorkerSelf;

ctx.onmessage = (event: MessageEvent<ConvertWorkerRequest>): void => {
  const req = event.data;
  try {
    const palette = loadPalette(req.brandKey);
    const image = {
      width: req.width,
      height: req.height,
      data: new Uint8ClampedArray(req.buffer),
    };
    const result =
      req.sourceType === 'pixelArt' || req.sourceType === 'beadPattern'
        ? mapPixelGrid(image, palette, req.options)
        : convertImage(image, palette, req.targetW, req.targetH, req.options);
    if (result.ok) {
      ctx.postMessage(result, [result.cells.buffer]);
    } else {
      ctx.postMessage(result);
    }
  } catch (err) {
    ctx.postMessage({
      ok: false,
      code: 'internal_error',
      message: `转换线程异常：${err instanceof Error ? err.message : String(err)}`,
    });
  }
};
