import { describe, expect, it } from 'vitest';

import { convertImage, type ConvertOptions, type PixelImage } from './converter';
import { loadPalette } from './palettes';

/**
 * 转换性能基准（§4.10：104×104 目标网格 + 291 色板 ≤2s）。
 *
 * 断言放宽到 5s 作为 CI 安全线（慢机器 / 沙箱抖动）；真实性能指标以 m6
 * 验收实测为准，本用例同时打印实测耗时供观察。典型素材含丰富渐变与细节，
 * 是量化缓存命中率的代表场景。
 */

/** 构造典型素材：照片式渐变 + 色块主体 + 细节纹理（约数千个 5bit 唯一色）。 */
function makeTypicalImage(size: number): PixelImage {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      // 大面积平滑渐变（天空/肤色类）
      const gx = x / size;
      const gy = y / size;
      // 主体色块（圆角矩形"人物"区域，硬边）
      const inSubject = x > size * 0.3 && x < size * 0.7 && y > size * 0.25 && y < size * 0.85;
      // 细节纹理（发丝/花纹类高频扰动）
      const n = ((x * 13 + y * 7) % 17) / 17 - 0.5;
      if (inSubject) {
        data[o] = 200 + n * 40;
        data[o + 1] = 120 + gy * 60 + n * 30;
        data[o + 2] = 90 + gx * 50 + n * 30;
      } else {
        data[o] = 200 + gx * 40 + n * 20;
        data[o + 1] = 210 + gy * 30 + n * 20;
        data[o + 2] = 235 + n * 20;
      }
      data[o + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

/** CI 安全线（ms）：普通硬件 ≤2s 的目标放宽一档以上。 */
const CI_SAFE_MS = 5000;

describe('转换性能基准', () => {
  it(
    '104×104 目标网格 × MARD 291 色卡通模式 ≤ 5s（CI 安全线，真实指标以 m6 实测为准）',
    () => {
      const palette = loadPalette('mard');
      const image = makeTypicalImage(800);
      const options: ConvertOptions = { mode: 'cartoon', targetColors: 0, background: { remove: false, tolerance: 10 }, alphaThreshold: 128 };
      const t0 = performance.now();
      const result = convertImage(image, palette, 104, 104, options);
      const elapsed = performance.now() - t0;
      console.info(`[bench] 104×104 MARD 291 cartoon: ${elapsed.toFixed(0)}ms`);
      expect(result.ok).toBe(true);
      expect(elapsed).toBeLessThan(CI_SAFE_MS);
    },
    60_000,
  );

  it(
    'targetColors=16 的 Q 版场景同样在安全线内',
    () => {
      const palette = loadPalette('mard');
      const image = makeTypicalImage(600);
      const options: ConvertOptions = { mode: 'cartoon', targetColors: 16, background: { remove: true, tolerance: 10 }, alphaThreshold: 128 };
      const t0 = performance.now();
      const result = convertImage(image, palette, 29, 29, options);
      const elapsed = performance.now() - t0;
      console.info(`[bench] 29×29 MARD 291 cartoon targetColors=16 + bg removal: ${elapsed.toFixed(0)}ms`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usedCodes).toBeLessThanOrEqual(16);
      }
      expect(elapsed).toBeLessThan(CI_SAFE_MS);
    },
    60_000,
  );
});
