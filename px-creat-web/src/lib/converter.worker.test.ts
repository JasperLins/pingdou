import { beforeAll, describe, expect, it } from 'vitest';

import type { ConvertWorkerRequest } from './converter.worker';
import type { ConvertResult, PixelImage } from './converter';

/**
 * Worker 入口冒烟测试：Vitest 走 Vite 管线（?raw CSV、lib 跨模块 import
 * 均按生产转换），注入 self 桩后直接驱动 onmessage 完成端到端转换。
 * 浏览器内的真实 Worker 构造由 converterClient 在 m2/m3 集成时联调。
 */

interface WorkerSelfStub {
  onmessage: ((event: { data: ConvertWorkerRequest }) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

/** 桩在模块加载前安装且全程复用（worker 模块的 onmessage 只绑定一次）。 */
const posted: unknown[] = [];
const stub: WorkerSelfStub = {
  onmessage: null,
  postMessage: (message) => {
    posted.push(message);
  },
};
(globalThis as unknown as Record<string, unknown>).self = stub;

/** 构造 RGBA 图。 */
function makeImage(w: number, h: number, paint: (x: number, y: number) => [number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

function dispatch(image: PixelImage, targetW: number, targetH: number): ConvertResult {
  const before = posted.length;
  stub.onmessage?.({
    data: {
      buffer: image.data.buffer as ArrayBuffer,
      width: image.width,
      height: image.height,
      targetW,
      targetH,
      brandKey: 'mard',
    },
  });
  expect(posted.length, 'worker 应回传一条消息').toBe(before + 1);
  return posted[posted.length - 1] as ConvertResult;
}

describe('converter.worker', () => {
  beforeAll(async () => {
    await import('./converter.worker');
    expect(stub.onmessage).not.toBeNull();
  });

  it('端到端：像素请求 → onmessage → 转换结果回传', () => {
    const image = makeImage(128, 128, (x, y) => (x < 64 && y < 64 ? [230, 30, 40] : [30, 200, 90]));
    const result = dispatch(image, 16, 16);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.w).toBe(16);
      expect(result.h).toBe(16);
      expect(result.cells).toHaveLength(256);
      const topLeft = result.cells[0];
      const bottomRight = result.cells[15 * 16 + 15];
      expect(topLeft).toBeGreaterThanOrEqual(0);
      expect(bottomRight).toBeGreaterThanOrEqual(0);
      expect(topLeft).not.toBe(bottomRight);
    }
  });

  it('边界错误同样回传（低分辨率）', () => {
    const image = makeImage(50, 50, () => [255, 255, 255]);
    const result = dispatch(image, 16, 16);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('low_resolution');
  });

  it('尺寸与缓冲不符的脏请求不崩溃，回传可判别错误码', () => {
    const before = posted.length;
    stub.onmessage?.({
      data: {
        buffer: new ArrayBuffer(8),
        width: 128,
        height: 128,
        targetW: 16,
        targetH: 16,
        brandKey: 'mard',
      },
    });
    expect(posted.length).toBe(before + 1);
    const result = posted[posted.length - 1] as ConvertResult;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.code).toBe('string');
  });
});
