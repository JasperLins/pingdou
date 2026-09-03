# M5 导出三件套：图纸 PNG/BOM CSV/工程 JSON

## Goal

实现导出三件套（文档 §4.7）与工程文件往返：图纸 PNG（制作照拼）、BOM 清单 CSV（采购对账）、工程 JSON（再编辑），版式复刻市面图库样图规格。

## Requirements

- 图纸 PNG（基于 lib/patternSheet）：网格图案区 + 每 5 格坐标刻度 + 底部图例（色块、色号、颗数）+ 标题；复刻样图版式（验收素材：55×63、17 色、MARD 样图，需用户提供或采集同类）。
- 版式选项（Beadify 调研第二轮采纳，报告 §5.5-C）：Pattern sheet（带图例完整版，默认）/ Pattern only（纯图版）双版式；Cell labels 格子色号标注开关（默认关）；Author 作者署名字段（可留空）。
- BOM CSV：色号、色名、颗数、占比、总颗数；行结构预留 brand/code/count。
- 工程 JSON：完整 §4.8 schema 导出；导入恢复（含 finish 与参考图）；旧版本字段缺省兼容（finish 可缺省等于 normal+100）。
- 导出入口集中在编辑器（含转换后与手绘后）；58×58 以上 A4 分页打印**不在本任务**（M7 批次）。
- 下载走 Blob，中文文件名兼容（作品标题）。

## Acceptance Criteria

- [ ] 图纸 PNG 版式与样图对照一致：网格+刻度+图例三要素齐全，Q5 过
- [ ] 双版式（Pattern sheet 默认 / Pattern only）、格子色号标注开关、作者署名字段全部生效
- [ ] BOM 色号全部在色板数据库存在（Q1），颗数/占比/总数统计正确
- [ ] 工程 JSON 导出→导入→再导出，数据逐字段一致；finish 缺省兼容旧文件
- [ ] 屏幕显示色与色卡 RGB 一致（Q6，抽查 3 品牌各 5 色）
- [ ] 三件套在 104×104 大图下导出不冻结 UI

## Notes

- 依赖：M1（patternSheet/storage）、M2（编辑器状态）。
- 样图对照素材不在本工作区（原 .uploads/），验收前需补：55×63 MARD 样图一张即可。
- 版式对照时评估"每行印色号"的行号标注（Beadify 做法，调研见 m2-editor/research-beadify.md 采纳项 11）。
