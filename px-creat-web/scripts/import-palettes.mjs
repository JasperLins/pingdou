/**
 * 色板数据再导入脚本：从上游数据集拉取五品牌 CSV，校验后写入 src/data/。
 *
 * 上游来源（MIT License）：
 *  - https://github.com/maxcleme/beadcolors            （MARD / Perler / Hama / Artkal）
 *  - https://github.com/lft123454321/bead_color_matcher（COCO）
 *
 * 产出规范（src/data/*.csv）：
 *  - 首部 `#` 注释行记录来源与抓取日期，随后一行表头；
 *  - 列固定为 code,name,r,g,b,color_type（color_type 为空 = 普通色）；
 *  - name 为上游缺失时回填为色号本身（MARD / COCO 无名称数据）；
 *  - color_type 仅标记有依据的特殊效果系列：MARD ZG1–ZG8 与 COCO GB1–GB8
 *    （两品牌该 8 组 RGB 序列互相对应，为珠光/特殊观感系列）。
 *
 * 用法：node scripts/import-palettes.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const BEADCOLORS_RAW = 'https://raw.githubusercontent.com/maxcleme/beadcolors/master/raw';
const COCO_RAW = 'https://raw.githubusercontent.com/lft123454321/bead_color_matcher/main';
const FETCH_DATE = new Date().toISOString().slice(0, 10);

/** 品牌清单：文件名、上游 URL、期望行数、上游名称列是否可用、特殊效果系列前缀。 */
const SOURCES = [
  { file: 'mard.csv', url: `${BEADCOLORS_RAW}/mard.csv`, expect: 291, hasName: true, effectPrefixes: ['ZG'] },
  { file: 'coco.csv', url: `${COCO_RAW}/COCO_ALL.csv`, expect: 293, hasName: false, effectPrefixes: ['GB'], skipHeader: true },
  { file: 'perler.csv', url: `${BEADCOLORS_RAW}/perler.csv`, expect: 103, hasName: true, effectPrefixes: [] },
  { file: 'hama.csv', url: `${BEADCOLORS_RAW}/hama.csv`, expect: 92, hasName: true, effectPrefixes: [] },
  { file: 'artkal_r.csv', url: `${BEADCOLORS_RAW}/artkal_r.csv`, expect: 89, hasName: true, effectPrefixes: [] },
  { file: 'artkal_s.csv', url: `${BEADCOLORS_RAW}/artkal_s.csv`, expect: 199, hasName: true, effectPrefixes: [] },
  { file: 'artkal_a.csv', url: `${BEADCOLORS_RAW}/artkal_a.csv`, expect: 145, hasName: true, effectPrefixes: [] },
  { file: 'artkal_c.csv', url: `${BEADCOLORS_RAW}/artkal_c.csv`, expect: 174, hasName: true, effectPrefixes: [] },
];

/** color_type 取值：pearl=珠光类特殊观感系列。 */
function effectTypeOf(code, prefixes) {
  return prefixes.some((p) => code.startsWith(p)) ? 'pearl' : '';
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/**
 * 解析上游行 → 规范行 {code,name,r,g,b,colorType}；返回 null 表示跳过（如表头）。
 * 上游两种格式：beadcolors `code,name,r,g,b[,contributor]`；COCO `code,r,g,b`（无名称列）。
 */
function parseRow(line, source) {
  const parts = line.split(',');
  if (source.skipHeader && parts[0] === 'COCO') return null;
  let code, name, rgb;
  if (source.hasName) {
    if (parts.length < 5) throw new Error(`字段不足：${line}`);
    [code, name, ...rgb] = [parts[0], parts[1], +parts[2], +parts[3], +parts[4]];
  } else {
    if (parts.length < 4) throw new Error(`字段不足：${line}`);
    [code, ...rgb] = [parts[0], +parts[1], +parts[2], +parts[3]];
    name = code; // 上游无名称数据，回填色号
  }
  const [r, g, b] = rgb;
  if (![r, g, b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    throw new Error(`RGB 越界：${line}`);
  }
  return { code, name, r, g, b, colorType: effectTypeOf(code, source.effectPrefixes) };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const seenArtkal = new Set();
  let total = 0;
  for (const source of SOURCES) {
    const text = await fetchText(source.url);
    const rows = [];
    const codes = new Set();
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const row = parseRow(line, source);
      if (!row) continue;
      if (codes.has(row.code)) throw new Error(`${source.file}: 色号重复 ${row.code}`);
      codes.add(row.code);
      rows.push(row);
    }
    if (rows.length !== source.expect) {
      throw new Error(`${source.file}: 期望 ${source.expect} 行，实际 ${rows.length} 行（上游数据已变化，需人工核对）`);
    }
    if (source.file.startsWith('artkal_')) {
      for (const row of rows) {
        if (seenArtkal.has(row.code)) throw new Error(`artkal 跨系列色号重复：${row.code}`);
        seenArtkal.add(row.code);
      }
    }
    const out = [
      `# source: ${source.url} (MIT License, see LICENSE-beadcolors.txt / LICENSE-bead-color-matcher.txt)`,
      `# fetched: ${FETCH_DATE} · rows: ${rows.length} · color_type 仅标记特殊效果系列（空 = 普通色）`,
      'code,name,r,g,b,color_type',
      ...rows.map((row) => [row.code, row.name, row.r, row.g, row.b, row.colorType].join(',')),
      '',
    ].join('\n');
    await writeFile(path.join(DATA_DIR, source.file), out, 'utf8');
    total += rows.length;
    console.log(`${source.file}: ${rows.length} rows OK`);
  }
  console.log(`total: ${total} (期望 1386)`);
  if (total !== 1386) throw new Error('总数不等于 1386');

  // 保留两份上游 LICENSE（MIT 保留声明要求）
  const [bcLicense, cocoLicense] = await Promise.all([
    fetchText('https://raw.githubusercontent.com/maxcleme/beadcolors/master/LICENSE'),
    fetchText(`${COCO_RAW}/LICENSE`),
  ]);
  await writeFile(path.join(DATA_DIR, 'LICENSE-beadcolors.txt'), bcLicense, 'utf8');
  await writeFile(path.join(DATA_DIR, 'LICENSE-bead-color-matcher.txt'), cocoLicense, 'utf8');
  console.log('LICENSE files written');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
