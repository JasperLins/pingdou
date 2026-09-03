# 技术设计 · M5 导出三件套

## 1. 交付物

1. **图纸 PNG**（制作照拼）：复用 lib/patternSheet（m1 已有 computeBom/computeSheetLayout/注入式 canvas 绘制；m4 已放宽 Int16Array）。**版式选项**（pixel-beads 采纳）：`sheetStyle: 'sheet'（带图例，默认）| 'plain'（纯图）`、`cellLabels: boolean`（格子色号标注，默认关）、`author?: string`（署名，画布下方小字）。每 5 格坐标刻度 + 图例（色块/色号/颗数）+ 标题。
2. **BOM CSV**：色号、色名、颗数、占比、总颗数；行结构含 brand/code/count 预留字段（对齐 BOMRow 契约）。UTF-8 BOM（Excel 中文兼容）；文件名 = 作品标题（非法字符清洗）。
3. **工程 JSON**：serializeProjectFile 已有（含 finish + refImage 内嵌）——补齐导入导出的 UI 与往返验证。

## 2. 组件

```text
components/editor/ExportDialog.tsx   导出对话框（三件套页签或分区卡）：
  - 图纸 PNG：版式双选（sheet/plain）+ cellLabels 开关 + 署名输入 + 预览缩略图
  - BOM CSV：预览表（前 N 行）+ 下载
  - 工程 JSON：说明（可再编辑/含参考图）+ 导出/导入
  - 全部走 Blob 下载（a[download]），中文文件名
store：无新 store（导出为纯动作，参数在对话框本地态）
```

- 导出入口：Studio 顶栏"导出"按钮（m4 已有导出 JSON，本任务升级为统一对话框承接）
- 大图不冻结：PNG 渲染走 finish.worker 之外的同步绘制可接受（patternSheet 为指令式 canvas，104×104 目标 <100ms 量级）；若实测超 50ms 再分片

## 3. 下载与文件名

- `downloadBlob(blob, filename)` 工具（含 .png/.csv/.json 扩展与标题清洗：`[\\/:*?"<>|]` → `_`）
- 三件套文件名：`{title}.png` / `{title}-BOM.csv` / `{title}.json`

## 4. 测试

- patternSheet 版式参数单测（sheet/plain 布局差异、cellLabels 开关绘制指令、author 字段）
- CSV 序列化单测（表头/转义/BOM 字节/总数行）
- ExportDialog 冒烟（三区渲染/开关联动/下载触发 mock）
- 往返：导出 JSON → parseProjectFile → 再导出逐字段一致（m1 storage.test 已有基础，补 UI 路径冒烟）
- 浏览器人工验收：真实下载三件套检查内容（主会话执行）

## 5. 实现偏差确认（check 复核 2026-09-04）

1. **cellLabels 超长色号跳过（替代首字母截断）**：格内印完整色号，`measureText` 判定放不下（如 Perler `80-15179`）的格子自动跳过标注（同一色号当次渲染只测量一次）。理由：首字母/前缀截断信息量极低且同前缀色号易误导；跳过后仍有每 5 格刻度与底部图例辅助定位。check 评估：采纳。
2. **字段命名沿用 m1 既有词汇**：design 稿的 `sheetStyle: 'sheet'|'plain'` 实现为 `layout: 'sheet'|'pattern_only'`（m1 `SheetLayoutKind` 既有命名），语义一致，避免同概念双名。
3. **导出文件扩展名 `.json`**：m4 旧版 `{title}.pindou.json` 随统一导出对话框改为 `{title}.json`；全仓（src + 任务文档）grep `.pindou.json` 零残留，m4 测试无引用，无回归。
