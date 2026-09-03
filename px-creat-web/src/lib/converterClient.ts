/**
 * 转换 Worker 的 Promise 调用封装（浏览器专用：Worker API 属 DOM 运行时）。
 *
 * 104×104 等大网格转换一律经 {@link runConvertInWorker} 发起，主线程只收
 * 结果（§4.10：>50ms 计算不得在主线程同步执行）。管线单测请直接测
 * ./converter 纯函数，本文件不做 Vitest 覆盖。
 */

import type { ConvertOptions, ConvertResult, ConvertSourceType, PixelImage } from './converter';
import type { BrandKey } from './types';

/** Worker 无响应的兜底超时（ms）。 */
const WORKER_TIMEOUT_MS = 60_000;

/**
 * 在 Worker 中执行图片转图纸转换。
 *
 * @param img 源图像素（RGBA；缓冲会被复制，调用方数据不被转移）
 * @param brandKey 品牌键
 * @param targetW 目标宽（格数；直映模式下忽略，网格由源图决定）
 * @param targetH 目标高（格数；直映模式下忽略）
 * @param options 转换参数（缺省 = DEFAULT_CONVERT_OPTIONS）
 * @param sourceType 源图类型（缺省 photo；pixelArt/beadPattern 走按格直映）
 * @returns 与同步 convertImage 相同结构的结果；Worker 故障时 reject
 */
export function runConvertInWorker(
  img: PixelImage,
  brandKey: BrandKey,
  targetW: number,
  targetH: number,
  options?: ConvertOptions,
  sourceType?: ConvertSourceType,
): Promise<ConvertResult> {
  return new Promise<ConvertResult>((resolve, reject) => {
    const worker = new Worker(new URL('./converter.worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('convert worker timeout'));
    }, WORKER_TIMEOUT_MS);
    const finish = (fn: () => void): void => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    worker.onmessage = (event: MessageEvent<ConvertResult>) => finish(() => resolve(event.data));
    worker.onerror = (event: ErrorEvent) =>
      finish(() => reject(new Error(event.message || 'convert worker failed')));

    const byteOffset = img.data.byteOffset;
    const byteLength = img.data.byteLength;
    const buffer = img.data.buffer.slice(byteOffset, byteOffset + byteLength);
    worker.postMessage(
      {
        buffer,
        width: img.width,
        height: img.height,
        targetW,
        targetH,
        brandKey,
        options,
        ...(sourceType ? { sourceType } : {}),
      },
      [buffer],
    );
  });
}
