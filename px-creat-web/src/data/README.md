# src/data · 色板数据（唯一权威来源）

五品牌 1,386 色的 CSV 数据（m1 任务 2026-09-04 从上游拉取入库）。

## 文件与色数（入库核验：各文件唯一色号无重复）

| 文件 | 品牌/系列 | 色数 |
| --- | --- | --- |
| `mard.csv` | MARD 码德 2.6mm | 291 |
| `coco.csv` | COCO 2.6mm | 293 |
| `perler.csv` | Perler 5mm | 103 |
| `hama.csv` | Hama Midi 5mm | 92 |
| `artkal_r.csv` | Artkal R 5mm | 89 |
| `artkal_s.csv` | Artkal S 5mm | 199 |
| `artkal_a.csv` | Artkal A 2.6mm | 145 |
| `artkal_c.csv` | Artkal C 2.6mm | 174 |
| 合计 | | **1,386** |

## CSV 格式

- 首部 `#` 注释行记录来源 URL 与抓取日期，随后一行表头：`code,name,r,g,b,color_type`；
- `color_type` 为空 = 普通色；当前仅标记 `pearl`（MARD ZG1–ZG8 / COCO GB1–GB8，两品牌该系列
  RGB 序列互相对应，为珠光类特殊观感色，默认不参与自动匹配）；
- MARD / COCO 上游无名称数据，`name` 列回填为色号本身。

## 来源与许可

- [maxcleme/beadcolors](https://github.com/maxcleme/beadcolors)（MIT）—— MARD / Perler / Hama / Artkal，见 `LICENSE-beadcolors.txt`
- [lft123454321/bead_color_matcher](https://github.com/lft123454321/bead_color_matcher)（MIT）—— COCO，见 `LICENSE-bead-color-matcher.txt`

再导入：`node scripts/import-palettes.mjs`（校验行数与唯一性，色数不符会报错停止）。

## 约定（根 AGENTS.md §4）

- 本目录是全生态（px-creat-web / server / 小程序）色板数据的**唯一权威来源**，各端不得自建副本；
- 数据结构：`BeadColor { brand, code, name, rgb, colorType? }`，由 `src/lib/palettes.ts` 解析；
- RGB 为屏幕参考值（实物以色卡为准）。
