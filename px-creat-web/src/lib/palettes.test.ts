import { describe, expect, it } from 'vitest';

import { rgbToHsl } from './color';
import {
  ACHROMATIC_FAMILY,
  BRAND_INFOS,
  findNearestColors,
  groupByFamily,
  hueFamilyOf,
  loadAllPalettes,
  loadPalette,
  parsePaletteCsv,
  searchColors,
} from './palettes';
import type { BeadColor, BrandKey } from './types';
import { BRAND_KEYS } from './types';

/** 需求文档 §4.5.1 的入库色数口径。 */
const EXPECTED_COUNTS: Record<BrandKey, number> = {
  mard: 291,
  coco: 293,
  perler: 103,
  hama: 92,
  artkal: 607, // R89 + S199 + A145 + C174
};

/** 特殊效果色（pearl）数量：MARD ZG×8 + COCO GB×8。 */
const EXPECTED_EFFECTS: Partial<Record<BrandKey, number>> = { mard: 8, coco: 8 };

describe('五品牌色板入库', () => {
  it('各品牌色数与需求文档 §4.5.1 一致，合计 1,386', () => {
    const all = loadAllPalettes();
    let total = 0;
    for (const key of BRAND_KEYS) {
      expect(all[key].colors.length, key).toBe(EXPECTED_COUNTS[key]);
      total += all[key].colors.length;
    }
    expect(total).toBe(1386);
  });

  it('逐品牌唯一色号无重复，RGB 全部合法', () => {
    for (const key of BRAND_KEYS) {
      const { colors } = loadPalette(key);
      const codes = new Set<string>();
      for (const c of colors) {
        expect(codes.has(c.code), `${key} 重复色号 ${c.code}`).toBe(false);
        codes.add(c.code);
        expect([c.rgb.r, c.rgb.g, c.rgb.b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${key} ${c.code}`).toBe(true);
        expect(c.brand).toBe(key);
      }
    }
  });

  it('artkal 四系列（R/S/A/C）合并后色号仍唯一', () => {
    const artkal = loadPalette('artkal');
    const codes = new Set(artkal.colors.map((c) => c.code));
    expect(codes.size).toBe(artkal.colors.length);
    const series = { R: /^R/, S: /^S/, A: /^A/, C: /^C/ } as const;
    for (const prefix of Object.keys(series) as Array<keyof typeof series>) {
      expect(artkal.colors.filter((c) => series[prefix].test(c.code)).length, `${prefix} 系列`).toBe(
        { R: 89, S: 199, A: 145, C: 174 }[prefix],
      );
    }
  });

  it('特殊效果色带 colorType 标记且不参与默认匹配', () => {
    for (const key of BRAND_KEYS) {
      const palette = loadPalette(key);
      const effectCount = palette.colors.filter((c) => c.colorType !== undefined).length;
      expect(effectCount, key).toBe(EXPECTED_EFFECTS[key] ?? 0);
      expect(palette.matchable.length).toBe(palette.colors.length - effectCount);
      for (const color of palette.colors) {
        if (color.colorType !== undefined) {
          expect(palette.matchable.includes(palette.colors.indexOf(color))).toBe(false);
        }
      }
    }
    // MARD ZG1 / COCO GB1 标记为 pearl
    const mard = loadPalette('mard').colors.find((c) => c.code === 'ZG1');
    expect(mard?.colorType).toBe('pearl');
    const coco = loadPalette('coco').colors.find((c) => c.code === 'GB1');
    expect(coco?.colorType).toBe('pearl');
  });

  it('品牌元数据完整', () => {
    for (const key of BRAND_KEYS) {
      expect(BRAND_INFOS[key].key).toBe(key);
      expect(BRAND_INFOS[key].label.length).toBeGreaterThan(0);
    }
  });

  it('labs 与 colors 同下标对齐', () => {
    const mard = loadPalette('mard');
    expect(mard.labs.length).toBe(mard.colors.length);
    expect(mard.labs[0].l).toBeGreaterThanOrEqual(0);
    expect(mard.labs[0].l).toBeLessThanOrEqual(100);
  });
});

describe('parsePaletteCsv', () => {
  it('解析规范 CSV（跳过注释与表头）', () => {
    const csv = '# 注释\n# 注释2\ncode,name,r,g,b,color_type\nA1,白色,255,255,255,\nA2,珠光,128,128,128,pearl\n';
    const colors = parsePaletteCsv(csv, 'mard');
    expect(colors).toHaveLength(2);
    expect(colors[0]).toEqual({ brand: 'mard', code: 'A1', name: '白色', rgb: { r: 255, g: 255, b: 255 } });
    expect(colors[1].colorType).toBe('pearl');
  });

  it('色号重复抛错', () => {
    const csv = 'code,name,r,g,b,color_type\nA1,x,1,2,3,\nA1,y,4,5,6,\n';
    expect(() => parsePaletteCsv(csv, 'mard')).toThrow(/重复/);
  });

  it('RGB 越界抛错', () => {
    const csv = 'code,name,r,g,b,color_type\nA1,x,300,2,3,\n';
    expect(() => parsePaletteCsv(csv, 'mard')).toThrow(/RGB/);
  });
});

describe('色系分组', () => {
  it('分组覆盖全部颜色且组名合法', () => {
    const mard = loadPalette('mard');
    const families = groupByFamily(mard);
    const grouped = families.reduce((sum, f) => sum + f.colors.length, 0);
    expect(grouped).toBe(mard.colors.length);
    for (const family of families) {
      expect(family.colors.length).toBeGreaterThan(0);
      expect(family.indices.length).toBe(family.colors.length);
    }
    // 无彩色殿后（若存在）
    if (families.some((f) => f.name === ACHROMATIC_FAMILY)) {
      expect(families[families.length - 1].name).toBe(ACHROMATIC_FAMILY);
    }
  });

  it('hueFamilyOf 桶判定', () => {
    expect(hueFamilyOf({ r: 255, g: 0, b: 0 })).toBe('红');
    expect(hueFamilyOf({ r: 255, g: 255, b: 0 })).toBe('黄');
    expect(hueFamilyOf({ r: 0, g: 128, b: 0 })).toBe('绿');
    expect(hueFamilyOf({ r: 30, g: 80, b: 220 })).toBe('蓝'); // h≈222
    expect(hueFamilyOf({ r: 0, g: 0, b: 255 })).toBe('蓝紫'); // h=240 恰在桶界
    expect(hueFamilyOf({ r: 128, g: 128, b: 128 })).toBe(ACHROMATIC_FAMILY);
    expect(hueFamilyOf({ r: 255, g: 255, b: 255 })).toBe(ACHROMATIC_FAMILY);
  });

  it('与 HSL 一致性抽查：MARD 存在非平凡色系分布', () => {
    const mard = loadPalette('mard');
    const families = groupByFamily(mard);
    // 至少有 6 个色系（291 色的真实色板）
    expect(families.length).toBeGreaterThanOrEqual(6);
    // 分组与 hueFamilyOf 逐色一致
    const byName = new Map(families.map((f) => [f.name, f]));
    for (const color of mard.colors) {
      const family = byName.get(hueFamilyOf(color.rgb));
      expect(family, color.code).toBeDefined();
      expect(family?.colors.includes(color), color.code).toBe(true);
    }
    // 饱和度抽样：红组里应有高饱和成员
    const red = byName.get('红');
    expect(red?.colors.some((c) => rgbToHsl(c.rgb).s > 0.5)).toBe(true);
  });
});

describe('色板搜索', () => {
  it('空查询返回全量', () => {
    expect(searchColors(loadPalette('mard'), '')).toHaveLength(291);
    expect(searchColors(loadPalette('mard'), '   ')).toHaveLength(291);
  });

  it('按色号搜索（大小写不敏感）', () => {
    const artkal = loadPalette('artkal');
    const hits = searchColors(artkal, 'r01');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((c) => c.code.toLowerCase().includes('r01'))).toBe(true);
  });

  it('按名称搜索', () => {
    const perler = loadPalette('perler');
    const hits = searchColors(perler, 'white');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((c) => c.name.toLowerCase().includes('white') || c.code.toLowerCase().includes('white'))).toBe(true);
  });

  it('无命中返回空数组', () => {
    expect(searchColors(loadPalette('hama'), '不存在的色号')).toHaveLength(0);
  });
});

describe('近似色查找', () => {
  it('结果按色差升序，且为可采购的真实色号', () => {
    const mard = loadPalette('mard');
    const hits = findNearestColors(mard, { r: 255, g: 0, b: 0 }, 5);
    expect(hits).toHaveLength(5);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].deltaE).toBeGreaterThanOrEqual(hits[i - 1].deltaE);
    }
    for (const hit of hits) {
      expect(mard.colors[hit.index]).toBe(hit.color);
    }
  });

  it('纯红的最近邻应为红系（高红色分量占比）', () => {
    const mard = loadPalette('mard');
    const best = findNearestColors(mard, { r: 255, g: 0, b: 0 }, 1)[0];
    expect(best.color.rgb.r).toBeGreaterThan(best.color.rgb.g);
    expect(best.color.rgb.r).toBeGreaterThan(best.color.rgb.b);
    expect(best.deltaE).toBeLessThan(30);
  });

  it('默认排除特殊效果色，显式开启后包含', () => {
    const coco = loadPalette('coco');
    const all = findNearestColors(coco, { r: 200, g: 180, b: 200 }, 293, false);
    expect(all.every((h) => h.color.colorType === undefined)).toBe(true);
    const withEffects = findNearestColors(coco, { r: 200, g: 180, b: 200 }, 293, true);
    expect(withEffects.some((h) => h.color.colorType === 'pearl')).toBe(true);
  });

  it('跨品牌近似色提示：同一查询色在不同品牌得到各自最近色', () => {
    const query = { r: 90, g: 140, b: 200 };
    const brands: BeadColor[] = BRAND_KEYS.map((key) => findNearestColors(loadPalette(key), query, 1)[0].color);
    const brandSet = new Set(brands.map((c) => c.brand));
    expect(brandSet.size).toBe(BRAND_KEYS.length);
  });
});
