import { describe, expect, it } from 'vitest';

import { ciede2000, rgbToHsl, rgbToLab, rgbDeltaE, type Lab } from './color';

/**
 * CIEDE2000 测试向量：Sharma, Wu & Dalal (2005) 官方数据集全量 34 对
 * （论文 Table 1；含 hue 折返、均值不连续与 C1'C2'=0 边界用例）。
 */
const SHARMA_VECTORS: Array<{ l1: Lab; l2: Lab; expected: number }> = [
  { l1: { l: 50, a: 2.6772, b: -79.7751 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 2.0425 },
  { l1: { l: 50, a: 3.1571, b: -77.2803 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 2.8615 },
  { l1: { l: 50, a: 2.8361, b: -74.02 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 3.4412 },
  { l1: { l: 50, a: -1.3802, b: -84.2814 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 1 },
  { l1: { l: 50, a: -1.1848, b: -84.8006 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 1 },
  { l1: { l: 50, a: -0.9009, b: -85.5211 }, l2: { l: 50, a: 0, b: -82.7485 }, expected: 1 },
  { l1: { l: 50, a: 0, b: 0 }, l2: { l: 50, a: -1, b: 2 }, expected: 2.3669 },
  { l1: { l: 50, a: -1, b: 2 }, l2: { l: 50, a: 0, b: 0 }, expected: 2.3669 },
  { l1: { l: 50, a: 2.49, b: -0.001 }, l2: { l: 50, a: -2.49, b: 0.0009 }, expected: 7.1792 },
  { l1: { l: 50, a: 2.49, b: -0.001 }, l2: { l: 50, a: -2.49, b: 0.001 }, expected: 7.1792 },
  { l1: { l: 50, a: 2.49, b: -0.001 }, l2: { l: 50, a: -2.49, b: 0.0011 }, expected: 7.2195 },
  { l1: { l: 50, a: 2.49, b: -0.001 }, l2: { l: 50, a: -2.49, b: 0.0012 }, expected: 7.2195 },
  { l1: { l: 50, a: -0.001, b: 2.49 }, l2: { l: 50, a: 0.0009, b: -2.49 }, expected: 4.8045 },
  { l1: { l: 50, a: -0.001, b: 2.49 }, l2: { l: 50, a: 0.001, b: -2.49 }, expected: 4.8045 },
  { l1: { l: 50, a: -0.001, b: 2.49 }, l2: { l: 50, a: 0.0011, b: -2.49 }, expected: 4.7461 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 50, a: 0, b: -2.5 }, expected: 4.3065 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 73, a: 25, b: -18 }, expected: 27.1492 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 61, a: -5, b: 29 }, expected: 22.8977 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 56, a: -27, b: -3 }, expected: 31.903 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 58, a: 24, b: 15 }, expected: 19.4535 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 50, a: 3.1736, b: 0.5854 }, expected: 1 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 50, a: 3.2972, b: 0 }, expected: 1 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 50, a: 1.8634, b: 0.5757 }, expected: 1 },
  { l1: { l: 50, a: 2.5, b: 0 }, l2: { l: 50, a: 3.2592, b: 0.335 }, expected: 1 },
  { l1: { l: 60.2574, a: -34.0099, b: 36.2677 }, l2: { l: 60.4626, a: -34.1751, b: 39.4387 }, expected: 1.2644 },
  { l1: { l: 63.0109, a: -31.0961, b: -5.8663 }, l2: { l: 62.8187, a: -29.7946, b: -4.0864 }, expected: 1.263 },
  { l1: { l: 61.2901, a: 3.7196, b: -5.3901 }, l2: { l: 61.4292, a: 2.248, b: -4.962 }, expected: 1.8731 },
  { l1: { l: 35.0831, a: -44.1164, b: 3.7933 }, l2: { l: 35.0232, a: -40.0716, b: 1.5901 }, expected: 1.8645 },
  { l1: { l: 22.7233, a: 20.0904, b: -46.694 }, l2: { l: 23.0331, a: 14.973, b: -42.5619 }, expected: 2.0373 },
  { l1: { l: 36.4612, a: 47.858, b: 18.3852 }, l2: { l: 36.2715, a: 50.5065, b: 21.2231 }, expected: 1.4146 },
  { l1: { l: 90.8027, a: -2.0831, b: 1.441 }, l2: { l: 91.1528, a: -1.6435, b: 0.0447 }, expected: 1.4441 },
  { l1: { l: 90.9257, a: -0.5406, b: -0.9208 }, l2: { l: 88.6381, a: -0.8985, b: -0.7239 }, expected: 1.5381 },
  { l1: { l: 6.7747, a: -0.2908, b: -2.4247 }, l2: { l: 5.8714, a: -0.0985, b: -2.2286 }, expected: 0.6377 },
  { l1: { l: 2.0776, a: 0.0795, b: -1.135 }, l2: { l: 0.9033, a: -0.0636, b: -0.5514 }, expected: 0.9082 },
];

describe('ciede2000（Sharma 2005 官方 34 向量）', () => {
  for (const [i, { l1, l2, expected }] of SHARMA_VECTORS.entries()) {
    it(`向量 ${i + 1}/34：ΔE00 = ${expected}`, () => {
      expect(ciede2000(l1, l2)).toBeCloseTo(expected, 4);
      // 对称性
      expect(ciede2000(l2, l1)).toBeCloseTo(expected, 4);
    });
  }

  it('同色差为 0', () => {
    expect(ciede2000({ l: 50, a: 10, b: -5 }, { l: 50, a: 10, b: -5 })).toBe(0);
  });
});

describe('rgbToLab', () => {
  it('白点 → L=100，a/b≈0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 2);
    expect(lab.a).toBeCloseTo(0, 2);
    expect(lab.b).toBeCloseTo(0, 2);
  });

  it('黑 → L=0，a/b=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 3);
    expect(lab.a).toBeCloseTo(0, 3);
    expect(lab.b).toBeCloseTo(0, 3);
  });

  it('sRGB 红的 D65 参考值', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(53.24, 1);
    expect(lab.a).toBeCloseTo(80.09, 0);
    expect(lab.b).toBeCloseTo(67.2, 0);
  });

  it('sRGB 绿的 D65 参考值', () => {
    const lab = rgbToLab({ r: 0, g: 255, b: 0 });
    expect(lab.l).toBeCloseTo(87.74, 1);
    expect(lab.a).toBeCloseTo(-86.18, 0);
    expect(lab.b).toBeCloseTo(83.18, 0);
  });
});

describe('rgbToHsl', () => {
  it('红 → h=0 s=1 l=0.5', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBeCloseTo(1, 6);
    expect(hsl.l).toBeCloseTo(0.5, 6);
  });

  it('纯灰 → s=0', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0);
  });

  it('黄色 → h=60', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 0 }).h).toBe(60);
  });
});

describe('rgbDeltaE', () => {
  it('同色为 0，不同色为正', () => {
    expect(rgbDeltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0);
    expect(rgbDeltaE({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 })).toBeGreaterThan(20);
  });
});
