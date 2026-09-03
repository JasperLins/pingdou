import { beforeAll, describe, expect, it } from 'vitest';

import type { FinishWorkerRequest, FinishWorkerResponse } from './finish.worker';
import type { FinishPaletteData } from './finish';

/**
 * Worker 入口冒烟测试：注入 self 桩后直接驱动 onmessage 完成端到端渲染。
 * 浏览器内的真实 Worker 构造由 finishClient 在集成时联调（对齐 converter.worker.test 模式）。
 */

interface WorkerSelfStub {
  onmessage: ((event: { data: FinishWorkerRequest }) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const posted: unknown[] = [];
const stub: WorkerSelfStub = {
  onmessage: null,
  postMessage: (message) => {
    posted.push(message);
  },
};
(globalThis as unknown as Record<string, unknown>).self = stub;

const PALETTE: FinishPaletteData = {
  rgbs: [230, 60, 70, 60, 180, 100, 40, 90, 200],
  lum: [99, 138, 88],
};

function makeCells(w: number, h: number): Int16Array {
  const cells = new Int16Array(w * h);
  for (let i = 0; i < cells.length; i++) cells[i] = i % 4 === 3 ? -1 : i % 3;
  return cells;
}

function dispatch(req: Omit<FinishWorkerRequest, 'paletteData' | 'w' | 'h' | 'cells'> & Partial<FinishWorkerRequest>): FinishWorkerResponse {
  const before = posted.length;
  const cells = req.cells ?? makeCells(8, 6);
  stub.onmessage?.({
    data: {
      cells,
      w: req.w ?? 8,
      h: req.h ?? 6,
      paletteData: PALETTE,
      preset: req.preset,
      intensity: req.intensity ?? 100,
      ...(req.pxPerCell !== undefined ? { pxPerCell: req.pxPerCell } : {}),
    },
  });
  expect(posted.length, 'worker 应回传一条消息').toBe(before + 1);
  return posted[posted.length - 1] as FinishWorkerResponse;
}

describe('finish.worker', () => {
  beforeAll(async () => {
    await import('./finish.worker');
    expect(stub.onmessage).not.toBeNull();
  });

  it('端到端：渲染请求 → onmessage → rgba 回传', () => {
    const res = dispatch({ preset: 'towel', intensity: 80, pxPerCell: 4 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.w).toBe(8 * 4);
      expect(res.h).toBe(6 * 4);
      expect(res.rgba).toHaveLength(8 * 4 * 6 * 4 * 4);
    }
  });

  it('六预设全部可渲染', () => {
    for (const preset of ['normal', 'towel', 'glitter', 'sequin', 'waffle', 'loofah'] as const) {
      const res = dispatch({ preset, intensity: 100 });
      expect(res.ok, preset).toBe(true);
    }
  });

  it('脏请求不崩溃，回传可判别错误', () => {
    const res = dispatch({
      cells: new Int16Array(3),
      w: 8,
      h: 6,
      preset: 'normal',
      intensity: 50,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain('cells');
  });
});
