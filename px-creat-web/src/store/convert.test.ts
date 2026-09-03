import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConvertFailure, ConvertSuccess, PixelImage } from '@/lib/converter';
import { useConvertStore, type ConvertRunner, type ConvertSource } from './convert';
import { useProjectStore } from './project';
import { useEditorStore } from './editor';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

function makePixels(w: number, h: number, checker: (x: number, y: number) => number): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const v = checker(x, y);
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

function makeSource(w = 128, h = 128): ConvertSource {
  return {
    name: 'test.png',
    width: w,
    height: h,
    dataUrl: 'data:image/png;base64,xxx',
    pixels: makePixels(w, h, (x, y) => ((x * 7 + y * 13) % 50) * 5),
  };
}

function okResult(w = 8, h = 8): ConvertSuccess {
  const cells = new Int16Array(w * h).fill(3);
  return { ok: true, w, h, cells, usedCodes: 1 };
}

function failure(code: ConvertFailure['code']): ConvertFailure {
  return { ok: false, code, message: '测试错误' };
}

/** 假 runner：记录调用并返回预设结果。 */
function fakeRunner(result: ConvertSuccess | ConvertFailure) {
  const calls: Array<{ w: number; h: number; sourceType?: string; targetColors?: number }> = [];
  const runner: ConvertRunner = (_img, _brand, targetW, targetH, options, sourceType) => {
    calls.push({ w: targetW, h: targetH, sourceType, targetColors: options?.targetColors });
    return Promise.resolve(result);
  };
  return { runner, calls };
}

function resetAll(): void {
  useConvertStore.getState().close();
  useProjectStore.setState({
    loaded: false,
    title: '',
    brandKey: 'mard',
    spec: '5mm',
    w: 0,
    h: 0,
    cells: new Int16Array(0),
    refImage: null,
    cellsVersion: 0,
    lastDiff: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
  useEditorStore.getState().resetEditor();
}

beforeEach(resetAll);
afterEach(resetAll);

// ---------------------------------------------------------------------------
// 状态机流转
// ---------------------------------------------------------------------------

describe('convert store 状态机', () => {
  it('idle → crop → config → converting → done 正向流转', async () => {
    const store = useConvertStore.getState();
    expect(useConvertStore.getState().step).toBe('idle');

    store.setSource(makeSource());
    expect(useConvertStore.getState().step).toBe('crop');
    expect(useConvertStore.getState().crop).toEqual({ x: 0, y: 0, w: 128, h: 128 });

    store.enterConfig();
    expect(useConvertStore.getState().step).toBe('config');
    expect(useConvertStore.getState().work?.width).toBe(128);

    const { runner } = fakeRunner(okResult());
    await store.startConvert(runner);
    expect(useConvertStore.getState().step).toBe('done');
    expect(useConvertStore.getState().result?.w).toBe(8);
  });

  it('任意工作态可回退上一步', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    useConvertStore.getState().backToCrop();
    expect(useConvertStore.getState().step).toBe('crop');

    useConvertStore.getState().enterConfig();
    const { runner } = fakeRunner(okResult());
    await useConvertStore.getState().startConvert(runner);
    expect(useConvertStore.getState().step).toBe('done');
    useConvertStore.getState().backToConfig();
    expect(useConvertStore.getState().step).toBe('config');
  });

  it('close 重置全部会话态（取消清理）', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    useConvertStore.getState().close();
    const s = useConvertStore.getState();
    expect(s.step).toBe('idle');
    expect(s.source).toBeNull();
    expect(s.work).toBeNull();
    expect(s.result).toBeNull();
    expect(s.params.genType).toBe('standard');
  });

  it('转换失败回到 config 并保留错误码', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const { runner } = fakeRunner(failure('near_solid_color'));
    await useConvertStore.getState().startConvert(runner);
    const s = useConvertStore.getState();
    expect(s.step).toBe('config');
    expect(s.error?.code).toBe('near_solid_color');
    expect(s.result).toBeNull();
  });

  it('失败后参数修正重跑，错误被成功结果清除', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    await useConvertStore.getState().runConvert(fakeRunner(failure('low_resolution')).runner);
    expect(useConvertStore.getState().error?.code).toBe('low_resolution');
    useConvertStore.getState().setParams({ targetSize: 87 });
    await useConvertStore.getState().runConvert(fakeRunner(okResult()).runner);
    expect(useConvertStore.getState().error).toBeNull();
    expect(useConvertStore.getState().result?.ok).toBe(true);
  });

  it('runConvert 参数指纹命中时跳过重复执行', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const { runner, calls } = fakeRunner(okResult());
    await useConvertStore.getState().runConvert(runner);
    await useConvertStore.getState().runConvert(runner);
    expect(calls).toHaveLength(1);
  });

  it('参数变更后指纹失效，重新执行', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const { runner, calls } = fakeRunner(okResult());
    await useConvertStore.getState().runConvert(runner);
    useConvertStore.getState().setParams({ targetColors: 24 });
    await useConvertStore.getState().runConvert(runner);
    expect(calls).toHaveLength(2);
    expect(calls[1].targetColors).toBe(24);
  });

  it('并发运行以最新者胜（慢的旧结果不覆盖新结果）', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const okA = okResult(9, 9);
    const okB = okResult(11, 11);
    let resolveA: (v: ConvertSuccess) => void = () => undefined;
    let resolveB: (v: ConvertSuccess) => void = () => undefined;
    const runnerA = () =>
      new Promise<ConvertSuccess>((resolve) => {
        resolveA = resolve;
      });
    const runnerB = () =>
      new Promise<ConvertSuccess>((resolve) => {
        resolveB = resolve;
      });
    const runA = useConvertStore.getState().runConvert(runnerA as ConvertRunner);
    const runB = useConvertStore.getState().runConvert(runnerB as ConvertRunner);
    resolveB(okB);
    await runB;
    resolveA(okA);
    await runA;
    expect(useConvertStore.getState().result?.w).toBe(11);
    expect(useConvertStore.getState().busy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 裁剪 / 缩放 / 类型三选
// ---------------------------------------------------------------------------

describe('convert store 裁剪与源图类型', () => {
  it('裁剪框被钳制在图界内并保持最小边', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource(100, 100));
    store.setCrop({ x: -20, y: 90, w: 500, h: 3 });
    // 最小边 = max(8, round(100*0.05)=5) = 8
    expect(useConvertStore.getState().crop).toEqual({ x: 0, y: 90, w: 100, h: 8 });
  });

  it('nudgeCrop 平移不越界', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource(100, 100));
    store.setCrop({ x: 50, y: 50, w: 40, h: 40 });
    store.nudgeCrop(30, 30);
    expect(useConvertStore.getState().crop).toEqual({ x: 60, y: 60, w: 40, h: 40 });
  });

  it('主体缩放钳制 100–400，直映类型强制回 100', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.setSubjectScale(999);
    expect(useConvertStore.getState().subjectScale).toBe(400);
    store.setSourceType('pixelArt');
    expect(useConvertStore.getState().subjectScale).toBe(100);
  });

  it('photo 类型主体缩放后 work 为裁剪框中心收缩区域', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource(200, 200));
    store.setCrop({ x: 50, y: 50, w: 100, h: 100 });
    store.setSubjectScale(200); // 收缩一半
    store.enterConfig();
    expect(useConvertStore.getState().work?.width).toBe(50);
    expect(useConvertStore.getState().work?.height).toBe(50);
  });

  it('pixelArt 类型忽略主体缩放，work = 裁剪框', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource(200, 200));
    store.setCrop({ x: 40, y: 40, w: 80, h: 80 });
    store.setSourceType('beadPattern');
    store.enterConfig();
    expect(useConvertStore.getState().work?.width).toBe(80);
  });

  it('重新裁剪进入 config 时旧结果作废', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const { runner } = fakeRunner(okResult());
    await useConvertStore.getState().runConvert(runner);
    expect(useConvertStore.getState().result).not.toBeNull();
    useConvertStore.getState().backToCrop();
    useConvertStore.getState().enterConfig();
    expect(useConvertStore.getState().result).toBeNull();
    expect(useConvertStore.getState().lastRunKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 生成类型预设联动
// ---------------------------------------------------------------------------

describe('convert store 生成类型预设', () => {
  it('Q版联动 29 档 + 16 色 + 卡通；区间内保留用户值', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.applyGenType('q');
    let p = useConvertStore.getState().params;
    expect(p.targetSize).toBe(29);
    expect(p.targetColors).toBe(16);
    expect(p.mode).toBe('cartoon');

    useConvertStore.getState().setParams({ targetSize: 24 });
    useConvertStore.getState().applyGenType('q');
    p = useConvertStore.getState().params;
    expect(p.targetSize).toBe(24); // 区间内不重置
  });

  it('写真联动 87 档 + 不限色 + 平滑', () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.applyGenType('realistic');
    const p = useConvertStore.getState().params;
    expect(p.targetSize).toBe(87);
    expect(p.targetColors).toBe(0);
    expect(p.mode).toBe('smooth');
  });
});

// ---------------------------------------------------------------------------
// 结果落工程
// ---------------------------------------------------------------------------

describe('adoptResult 落工程', () => {
  it('cells 以一条 undo 写入 + 参考层透写下置', async () => {
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const result = okResult(16, 16);
    const { runner } = fakeRunner(result);
    await useConvertStore.getState().startConvert(runner);
    useConvertStore.getState().adoptResult('data:image/png;base64,ref');

    const project = useProjectStore.getState();
    expect(project.loaded).toBe(true);
    expect(project.w).toBe(16);
    expect(project.h).toBe(16);
    expect(project.cells[0]).toBe(3);
    expect(project.refImage?.dataUrl).toBe('data:image/png;base64,ref');
    expect(useEditorStore.getState().refMode).toBe('under');
    expect(useEditorStore.getState().refVisible).toBe(true);
    // 一条 undo：撤销后回到全空网格
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().undoStack[0].label).toBe('导入转图');
    project.undo();
    expect(useProjectStore.getState().cells[0]).toBe(-1);
    // 会话关闭
    expect(useConvertStore.getState().step).toBe('idle');
  });

  it('已有工程且网格一致时不重建品牌', async () => {
    useProjectStore.setState({ loaded: true, brandKey: 'coco', spec: '2.6mm', w: 16, h: 16, cells: new Int16Array(256).fill(-1) });
    const store = useConvertStore.getState();
    store.setSource(makeSource());
    store.enterConfig();
    const { runner } = fakeRunner(okResult(16, 16));
    await useConvertStore.getState().startConvert(runner);
    useConvertStore.getState().adoptResult('data:ref');
    expect(useProjectStore.getState().brandKey).toBe('coco');
    expect(useProjectStore.getState().spec).toBe('2.6mm');
  });
});
