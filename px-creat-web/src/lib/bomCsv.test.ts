import { describe, expect, it } from 'vitest';

import { serializeBomCsv } from './bomCsv';
import { computeBom } from './patternSheet';
import { loadPalette } from './palettes';
import type { BomRow } from './types';

const ROWS: BomRow[] = [
  { brand: 'mard', code: 'A1', name: '奶白', rgb: { r: 249, g: 240, b: 205 }, count: 600 },
  { brand: 'mard', code: 'A10', name: '橘', rgb: { r: 255, g: 157, b: 85 }, count: 200 },
];

function linesOf(csv: string): string[] {
  return csv.slice(1).trimEnd().split('\r\n');
}

describe('serializeBomCsv', () => {
  it('表头 / 数据行 / 总颗数行 / UTF-8 BOM / CRLF 行尾', () => {
    const csv = serializeBomCsv(ROWS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(linesOf(csv)).toEqual([
      '品牌,色号,色名,颗数,占比',
      'mard,A1,奶白,600,75.00%',
      'mard,A10,橘,200,25.00%',
      '总计,,,800,100.00%',
    ]);
  });

  it('字段含逗号 / 引号 / 换行时按 RFC 4180 转义（引号双写）', () => {
    const tricky: BomRow[] = [
      { brand: 'perler', code: '80-15179', name: 'Ever"green, dark\nblue', rgb: { r: 0, g: 0, b: 0 }, count: 3 },
    ];
    const csv = serializeBomCsv(tricky);
    expect(csv).toContain('"Ever""green, dark\nblue"');
    expect(linesOf(csv)[1].startsWith('perler,80-15179,')).toBe(true);
  });

  it('空 BOM：仅表头与总计 0 行', () => {
    expect(linesOf(serializeBomCsv([]))).toEqual(['品牌,色号,色名,颗数,占比', '总计,,,0,0.00%']);
  });

  it('与 computeBom 直连：行序与颗数一致（颗数降序）', () => {
    const palette = loadPalette('mard');
    const cells = [0, 0, 0, 5, 5, -1];
    const csv = serializeBomCsv(computeBom(cells, 3, 2, palette));
    const lines = linesOf(csv);
    expect(lines).toHaveLength(4); // 表头 + 2 色 + 总计
    expect(lines[1]).toBe(`mard,${palette.colors[0].code},${palette.colors[0].name},3,60.00%`);
    expect(lines[2]).toBe(`mard,${palette.colors[5].code},${palette.colors[5].name},2,40.00%`);
    expect(lines[3]).toBe('总计,,,5,100.00%');
  });
});
