// @vitest-environment jsdom
/**
 * 转换流组件冒烟（design.md §6）：状态机宿主渲染、三张类型卡联动、档位 chips、
 * 对照视图占位、done 步与入口交棒。画布像素与 Worker 接线留浏览器人工验收
 * （jsdom 无 2D context 与 Worker，渲染守卫为 no-op）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ImportDialog } from './ImportDialog';
import { NewDialog } from './NewDialog';
import type { PixelImage } from '@/lib/converter';
import { useConvertStore, type ConvertSource } from '@/store/convert';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';

function makePixels(w: number, h: number): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i / 4) % 256;
    data[i + 1] = (i / 8) % 256;
    data[i + 2] = (i / 16) % 256;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

function makeSource(w = 128, h = 128): ConvertSource {
  return {
    name: 'smoke.png',
    width: w,
    height: h,
    dataUrl: 'data:image/png;base64,smoke',
    pixels: makePixels(w, h),
  };
}

function resetStores(): void {
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

beforeEach(resetStores);
afterEach(() => {
  cleanup();
  resetStores();
});

describe('ImportDialog 状态机宿主', () => {
  it('idle 步渲染上传区', () => {
    render(<ImportDialog open onClose={() => undefined} />);
    expect(screen.getByText('拖一张图进来，或点击选择文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
  });

  it('crop 步：类型三选 + 豆宽预估 + 主体缩放', () => {
    render(<ImportDialog open onClose={() => undefined} />);
    act(() => {
      useConvertStore.getState().setSource(makeSource(128, 128));
    });
    expect(useConvertStore.getState().step).toBe('crop');

    expect(screen.getByText('源图类型')).toBeInTheDocument();
    expect(screen.getByText('普通图片')).toBeInTheDocument();
    expect(screen.getByText('像素画')).toBeInTheDocument();
    expect(screen.getByText('拼豆图纸')).toBeInTheDocument();
    // 默认 52 档 × 裁剪框 100% 宽 = 52 颗宽（数字在 <b> 内，用段落级匹配）
    const beadPara = (_: string, el: Element | null): boolean =>
      el?.tagName === 'P' && (el.textContent?.includes('预估约 52 颗宽') ?? false);
    expect(screen.getByText(beadPara)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '主体缩放百分比' })).toBeInTheDocument();

    // 直映类型：主体缩放禁用并复位
    fireEvent.click(screen.getByRole('button', { name: /像素画/ }));
    expect(useConvertStore.getState().sourceType).toBe('pixelArt');
    expect(useConvertStore.getState().subjectScale).toBe(100);
    expect(screen.getByRole('slider', { name: '主体缩放百分比' })).toBeDisabled();
  });

  it('config 步：三张类型卡联动 + 尺寸/色数档位 chips', () => {
    render(<ImportDialog open onClose={() => undefined} />);
    act(() => {
      useConvertStore.getState().setSource(makeSource());
    });
    fireEvent.click(screen.getByRole('button', { name: '下一步：设置参数' }));
    expect(useConvertStore.getState().step).toBe('config');

    // 三张生成类型卡
    fireEvent.click(screen.getByRole('button', { name: /Q版/ }));
    let params = useConvertStore.getState().params;
    expect(params.genType).toBe('q');
    expect(params.targetSize).toBe(29);
    expect(params.targetColors).toBe(16);
    expect(params.mode).toBe('cartoon');

    // 写真卡：87 档 + 不限 + 平滑
    fireEvent.click(screen.getByRole('button', { name: /写真/ }));
    params = useConvertStore.getState().params;
    expect(params.targetSize).toBe(87);
    expect(params.targetColors).toBe(0);
    expect(params.mode).toBe('smooth');

    // 尺寸档位 chips 可覆盖
    fireEvent.click(screen.getByRole('button', { name: '104' }));
    expect(useConvertStore.getState().params.targetSize).toBe(104);
    // targetColors 档位 chips
    fireEvent.click(screen.getByRole('button', { name: '48' }));
    expect(useConvertStore.getState().params.targetColors).toBe(48);
    fireEvent.click(screen.getByRole('button', { name: '不限' }));
    expect(useConvertStore.getState().params.targetColors).toBe(0);

    // 对照视图占位（无 Worker 环境不重跑）
    expect(screen.getByText(/原图/)).toBeInTheDocument();
    expect(screen.getByText('等待预览')).toBeInTheDocument();
  });

  it('done 步：结果画布与进编辑器按钮', () => {
    render(<ImportDialog open onClose={() => undefined} />);
    act(() => {
      useConvertStore.getState().setSource(makeSource());
      useConvertStore.setState({
        step: 'done',
        work: makeSource().pixels,
        result: { ok: true, w: 16, h: 16, cells: new Int16Array(256).fill(2), usedCodes: 1 },
      });
    });
    expect(screen.getByRole('button', { name: '进编辑器精修' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回调整' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '转换结果 16×16 格' })).toBeInTheDocument();
  });

  it('取消关闭清理会话', () => {
    const onClose = vi.fn();
    render(<ImportDialog open onClose={onClose} />);
    act(() => {
      useConvertStore.getState().setSource(makeSource());
    });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalled();
    expect(useConvertStore.getState().step).toBe('idle');
    expect(useConvertStore.getState().source).toBeNull();
  });
});

describe('NewDialog 入口两路径', () => {
  it('默认空白画布路径，含可选参考图导入', () => {
    render(<NewDialog open onClose={() => undefined} />);
    expect(screen.getByText(/空白画布 \/ 导入我的作品/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始创作' })).toBeInTheDocument();
    expect(screen.getByText('选择参考图')).toBeInTheDocument();
  });

  it('「从图片转图」路径交棒 onOpenConvert', () => {
    const onOpenConvert = vi.fn();
    const onClose = vi.fn();
    render(<NewDialog open onClose={onClose} onOpenConvert={onOpenConvert} />);
    fireEvent.click(screen.getByRole('button', { name: /从图片转图/ }));
    fireEvent.click(screen.getByRole('button', { name: '去转图' }));
    expect(onOpenConvert).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
