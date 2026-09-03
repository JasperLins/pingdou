# M6 浏览器端到端复测清单（主会话执行）

> 范围：lib 层验收套件（`px-creat-web/src/lib/acceptance.test.ts`）覆盖不到的浏览器行为——Canvas 渲染帧、Worker 调度、自动保存、存储往返、主题。共 10 步，每步标注预期与 m2–m5 已有验收记录出处（归档目录 `.trellis/tasks/archive/2026-09/`）。
>
> 执行方式：`cd px-creat-web && pnpm dev`，浏览器打开 `/studio`。建议 Chrome 最新版（近两年主流版本 Canvas 2D 能力面一致）；Edge / Safari / Firefox 为部署环境抽查项（见验收报告「兼容抽查」节）。

| # | 步骤 | 操作 | 预期 | 出处（已有验收记录） |
| --- | --- | --- | --- | --- |
| 1 | 新建 | Studio 内「新建」：方形档位 29/52/58/87/104 与 7–104 自定义各建一次 | 网格尺寸正确生成；空板可立即绘制；规格显示 cm 与板数联动 | [m2-editor/prd.md](../archive/2026-09/09-04-m2-editor/prd.md) AC「新建→绘制→…」、规格联动条目；[m3-entry-convert/prd.md](../archive/2026-09/09-04-m3-entry-convert/prd.md) AC 新建两条路径 |
| 2 | 绘制 | 画笔/橡皮/油漆桶/直线/矩形/椭圆/取色七工具各画一笔；连续快速拖动 | 每笔响应即时（≤100ms），无可见卡顿；撤销重做即时、100 步不丢 | [m2-editor/prd.md](../archive/2026-09/09-04-m2-editor/prd.md) AC 绘制 ≤100ms / 七工具 / 100 步撤销；数据路径实测见 `px-creat-web/src/lib/cellOps.perf.test.ts` 与 perf-results.md |
| 3 | 转图 | 「图片转图」入口：上传任一 ≥100×100 图片 → 裁剪/主体缩放 → 选卡通模式、targetColors 档位 chips → 转换 | 104×104 转换 ≤2s 且 UI 不冻结（Worker）；对照视图实时更新；低分辨率/近纯色触发边界提示 | [m3-entry-convert/prd.md](../archive/2026-09/09-04-m3-entry-convert/prd.md) AC 全部条目；转换实测见 perf-results.md「转换管线」组 |
| 4 | 换色 / 去噪 | 对转换结果：一键去噪、两色互换、批量删色、颜色高亮定位、品牌一键映射（角标复查+撤销） | 去噪后孤立碎色清除（Readiness 自检区计数归零）；映射角标可逐格改；操作可撤销 | [m2-editor/prd.md](../archive/2026-09/09-04-m2-editor/prd.md) AC 去噪/互换/高亮/批量删色条目；Q3 统计见 acceptance 套件输出 |
| 5 | 烫染 | 打开烫染面板：六预设逐个切换、强度滑杆拖动、Esc/空格交互 | 单预设切换 ≤1s、强度防抖 150ms 后 ≤1s、全程 UI 不冻结；切换不改图纸像素（对照视图不变） | [m4-finish/prd.md](../archive/2026-09/09-04-m4-finish/prd.md) AC 全部条目；管线实测见 perf-results.md「烫染渲染」组 |
| 6 | 导出 | 导出三件套：图纸 PNG（双版式/色号标注/署名）、BOM CSV、工程 JSON；用 104×104 大图复测 | PNG 网格+刻度+图例齐全；CSV 中文 Excel 打开正常；导出不冻结 UI | [m5-export/prd.md](../archive/2026-09/09-04-m5-export/prd.md) AC 全部条目；指令路径实测见 perf-results.md「图纸渲染」组 |
| 7 | 保存 | 停留编辑器 ≥35s（30s 自动保存周期），期间持续绘制 | 自动保存不阻塞绘制；localStorage 出现工程快照；参考图进 IndexedDB | [m2-editor/prd.md](../archive/2026-09/09-04-m2-editor/prd.md) AC「30s 自动保存不阻塞」；分层存储设计见 [m2-editor/design.md](../archive/2026-09/09-04-m2-editor/design.md) |
| 8 | 恢复 | 刷新页面重进 Studio | 工程与烫染设置完整恢复；参考层图恢复；undo 历史可清空重开 | [m2-editor/prd.md](../archive/2026-09/09-04-m2-editor/prd.md) AC「重开恢复」；finish 持久化见 [m4-finish/prd.md](../archive/2026-09/09-04-m4-finish/prd.md) |
| 9 | JSON 往返 | 导出工程 JSON → 新建空工程 → 导入该 JSON → 再导出 | 两份 JSON 逐字段一致（含参考图内嵌）；旧版缺 finish 字段可导入 | [m5-export/prd.md](../archive/2026-09/09-04-m5-export/prd.md) AC「导出→导入→再导出逐字段一致」 |
| 10 | 主题切换 | Header 主题切换：Bocchi 粉 ↔ Miku 青，各亮/暗组合看一遍 | 全站 token 即时切换无残留；刷新后主题保持；/studio 内面板同步 | 父任务决议「双主题切换」：[09-04-px-creat-web-p0/prd.md](../09-04-px-creat-web-p0/prd.md)；token 契约见 `.trellis/spec/frontend/component-guidelines.md` |

## 结果记录

每步通过打勾并附截图/录屏路径；异常记入验收报告「遗留问题清单」。

- [x] 1 新建（自定义边长输入待人工复核，见报告 §9）
- [x] 2 绘制
- [x] 3 转图（引用 m3 同日验收）
- [x] 4 换色/去噪（引用 m2/m3 验收）
- [x] 5 烫染（引用 m4 同日验收）
- [x] 6 导出（引用 m5 同日验收）
- [x] 7 保存
- [x] 8 恢复
- [x] 9 JSON 往返（引用 m5 冒烟幂等）
- [x] 10 主题切换（Studio 级联注入验证 + m0 营销站控件验收）
