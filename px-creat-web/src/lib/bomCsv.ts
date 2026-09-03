/**
 * BOM 清单 CSV 序列化（§4.7 导出三件套之二，采购对账用）。
 *
 * 口径（M5 design.md §1.2）：
 * - 表头 `品牌,色号,色名,颗数,占比`：brand/code 为 P1 商业映射的契约预留字段
 *   （对齐 {@link BomRow}），颗数/占比为对账主数据；
 * - 末行 `总计,,,N,100.00%` 汇总总颗数；
 * - 首字符 U+FEFF（UTF-8 BOM）+ CRLF 行尾：Excel 双击打开中文不乱码，
 *   UI 层以 `new Blob([csv], { type: 'text/csv;charset=utf-8' })` 落盘；
 * - 字段转义遵循 RFC 4180：含逗号 / 引号 / 换行的字段整体加引号，内部引号双写。
 */

import type { BomRow } from './types';

/** CSV 字段转义（RFC 4180：特殊字符字段加引号，引号双写）。 */
function csvField(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/**
 * 序列化 BOM 为 CSV 文本（含 UTF-8 BOM 与 CRLF 行尾）。
 *
 * @param bom BOM 行（通常为 computeBom 产物；行序原样保留，不做排序）
 */
export function serializeBomCsv(bom: readonly BomRow[]): string {
  const total = bom.reduce((sum, row) => sum + row.count, 0);
  const lines: string[] = ['品牌,色号,色名,颗数,占比'];
  for (const row of bom) {
    const ratio = total > 0 ? ((row.count / total) * 100).toFixed(2) : '0.00';
    lines.push([row.brand, row.code, row.name, row.count, `${ratio}%`].map(csvField).join(','));
  }
  lines.push(['总计', '', '', total, total > 0 ? '100.00%' : '0.00%'].map(csvField).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
