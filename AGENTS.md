<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

# 拼豆线上生态（PinDou）项目记忆

> 本区块是 AI 开发的项目记忆与代码规范总纲。**《拼豆线上生态项目开发需求文档-V4.0总纲.md》是初步基线文档**：实际开发中基于它进行讨论演进，而不是全部照搬其中的内容；凡实现与文档冲突，以最新讨论结论为准，并将结论回写需求文档或本文件。本文只做索引与约定，不复制需求细节。

## 1. 项目全景

架构：**拼豆生态 × 芋道（ruoyi-vue-pro）底座**。`px-creat-web` 为独立 SPA，经 REST API 接入同一服务端；其余前端/客户端均基于芋道全家桶。**每个子项目有自己的 AGENTS.md**（结构、功能、代码规范、找代码指南），进入子项目工作前先读它：

| 目录 | 角色 | 技术栈 | 优先级 | 子项目文档 |
| --- | --- | --- | --- | --- |
| `px-creat-web/` | **Web 创作端**（创作者画图、图片转图纸、烫染预览、BOM 导出） | React + TypeScript + Vite，独立 SPA，**需良好 SEO** | P0（当前开发重心） | [px-creat-web/AGENTS.md](px-creat-web/AGENTS.md) |
| `lineone-ui-demo/` | **仅作 UI 参考**：px-creat-web 的视觉、组件形态、交互方式参考模板。**禁止**在其内部开发业务代码 | Tailwind CSS Admin UI Kit | 参考资产 | [lineone-ui-demo/AGENTS.md](lineone-ui-demo/AGENTS.md) |
| `server/` | 后端服务（ruoyi-vue-pro fork，包根 `cn.pixel.pingDou`，端口 48080，当前仅启用 system/infra/member/bpm/pay 模块） | JDK 17+ · Spring Boot 3.5 · MyBatis Plus，Maven 多模块 | 基石 | [server/AGENTS.md](server/AGENTS.md) |
| `yudao-ui-admin-vue3/` | Admin 管理后台 | Vue3 + element-plus + Vite + TS，pnpm | 基石 | [yudao-ui-admin-vue3/AGENTS.md](yudao-ui-admin-vue3/AGENTS.md) |
| `yudao-ui-admin-uniapp/` | 小程序消费端（P1） | uni-app + Vue3 + `@wot-ui/ui`（wot-design-uni）+ TS，pnpm | P1 | [yudao-ui-admin-uniapp/AGENTS.md](yudao-ui-admin-uniapp/AGENTS.md) |

优先级路线：P0 Web 创作端 → P1 云端图库 + 小程序消费端 → P2 App / 蓝牙智能板 / AI 起稿 / 定制代拼。P0→P1 以"图库有产出"为标志，不以时间为标志。

### px-creat-web 说明

- M0 工程已搭建（2026-09-04）：Vite + React 18 + TypeScript(strict) + Tailwind CSS v3 + zustand + Vitest，pnpm 管理。已有双主题 token（Bocchi 粉默认 / Miku 青 × 亮暗四组合）、`components/ui/` 起步组件（`/dev/ui` 演示页）、路由分区（marketing 可预渲染 / studio 纯 CSR）。`web-style/` 仍为**整站视觉风格基准**（`bocchi the rock.jpg` 粉色主题与 `Miku UI Design.jpg` 青色主题，同一版式骨架的二次元可爱风 UI，只读）；编辑器/转换算法在 m2+ 落地。
- **SEO 要求**：独立 SPA 但需要被搜索引擎收录，采用 SSR/SSG 方案（推荐 Next.js 或 Vite + 预渲染/SSR 方案，落地时定稿并回写本文）。营销页（首页、图库、作品详情、分享页）必须 SSR/预渲染；编辑器等纯工具页面可 CSR。2026-09-04 定稿：采用 Vite 构建后自研预渲染脚本（`scripts/prerender.mjs`，react-dom/server 静态渲染营销页并注入 meta/OG，零新增依赖），营销页构建产物含静态 HTML；P1 图库前再评估 Next.js。
- UI 组件**结构参考** `lineone-ui-demo/src/html/` 的组件页（components-*.html、dashboards-*.html、apps-*.html）与 `src/css/`，用自己的 React 组件复刻结构与交互形态，不直接搬运其 Alpine.js 代码；整站视觉 token（配色/圆角/字体气质）以 `web-style/` 双图为基准，不沿用 lineone 的 navy 后台风。
- 核心算法（转换管线、CIEDE2000 色彩匹配、烫染渲染）须实现为 `src/lib/` 下与 UI 解耦的纯函数库，与需求文档 4.9 的代码结构约定一致。

## 2. 需求索引（初步基线，详见需求文档对应章节）

> 需求文档是初步文档，章节内容在开发讨论中可能调整；引用章节号仅作快速定位。

- 三类创作入口（自由创作 / 导入作品 / 图片转图）与生成类型（Q版/标准/写真）：§4.3
- 转换技术管线（区域平均 + CIEDE2000 + 默认无抖动）：§4.3.4
- 精修编辑器能力与快捷键体系：§4.4
- 品牌色号系统（MARD/COCO/Perler/Hama/Artkal，1,386 色，不限制色号使用）：§4.5
- 烫染效果预览（滤镜式交互，8 预设，Canvas 2D 管线）：§4.6
- 导出三件套（图纸 PNG / BOM CSV / 工程 JSON）：§4.7；工程 JSON 数据模型：§4.8
- 图纸质量验收 Q1–Q6：§4.2.2；P0 验收标准：§4.11
- 性能指标（转换 ≤2s、绘制响应 ≤100ms 等）：§4.10、§4.6.6

## 3. 代码规范

### 3.1 通用

- 提交信息用中文或中英混合，格式：`<类型>: <描述>`（feat / fix / refactor / docs / chore / style / test）。
- 所有 TS/JS/Java 源码必须通过各自项目的类型检查后才算完成；禁止提交 `any` 滥用与未使用变量。
- 命名：组件 PascalCase、函数/变量 camelCase、常量 SCREAMING_SNAKE、文件——React 组件 `.tsx` PascalCase，工具模块 `.ts` camelCase；Java 遵循芋道现有规范。
- 注释密度对齐所在文件既有风格；只在表达代码无法自明的约束时才写注释。

### 3.2 px-creat-web（React + TS）

- 目录结构遵循需求文档 §4.9：`src/lib/`（纯函数算法库，无 React 依赖）+ `src/components/` + `src/data/`（色板数据）。
- 组件用函数组件 + Hooks。状态管理已定稿（2026-09-04）：**zustand**（画布/工程状态与主题状态统一走 `src/store/`，持久化用 persist 中间件；范例 `px-creat-web/src/store/theme.ts`），不引入 redux；少量纯 UI 上下文可用 context。
- 样式采用 Tailwind CSS，视觉 token 对齐 `web-style/` 双图基准（lineone 仅组件结构参考）；主题色、间距等设计 token 集中定义，不散落硬编码。
- 画布重计算、烫染渲染放 Web Worker 或分片任务，禁止冻结 UI（§4.6.4 关键规则）。
- SEO：页面 `<title>`/meta/OG 标签必须由路由层统一管理；作品分享页 OG 图用烫染效果封面。

### 3.3 server（Spring Boot，芋道规范）

- 遵循 ruoyi-vue-pro 现有分层：controller → service → dal(mysql/redis)，模块内 `controller/admin` 与 `controller/app` 分包。
- 拼豆业务新模块命名为 `pingDou-module-pindou`（建议），或在既有模块内按芋道包规范扩展；不改动框架层（`pingDou-framework`）除非必要。
- 数据库表名/字段遵循芋道约定（小写下划线、逻辑删除 `deleted`、租户字段等）；SQL 变更同步 `sql/` 目录。
- 对外 REST API 是 px-creat-web 的唯一接入方式，接口风格对齐芋道 `CommonResult` 包装。

### 3.4 yudao-ui-admin-vue3 / yudao-ui-admin-uniapp

- 严格遵循芋道前端既有规范（API 层 `src/api/` 与 views/pages 一一对应、组合式 API、已有 eslint/stylelint/prettier 配置），新代码不改既有 lint 规则。
- 包管理器固定 pnpm。

## 4. 协作约定

- 修改需求文档、架构选型、色板数据结构、工程 JSON schema（§4.8）等契约性内容时，必须同步更新本文件对应章节。
- `lineone-ui-demo/` 与 `px-creat-web/web-style/` 是参考资产，只读，不承载业务逻辑。
- 色板 CSV 数据源（beadcolors，MIT，[maxcleme/beadcolors](https://github.com/maxcleme/beadcolors)，`data/*.csv`：key,brand,name,color(rgb hex)）入库后以 `px-creat-web/src/data/` 为唯一权威来源，各端不得各自维护副本。

## 5. ZCode MCP 能力使用约定（按场景调用，优先用足平台额度）

以下 MCP 已在本项目会话中自动连接，开发时按场景主动调用，替代手写脚本/人工翻网页：

| 开发场景 | 调用的 MCP / 工具 | 说明 |
| --- | --- | --- |
| 技术与数据源调研（色板 CSV、CIEDE2000 实现、SSR 选型、库版本） | `web_reader`（网页正文抓取）+ WebSearch | 抓 GitHub/文档页正文，产出调研结论落任务 `prd.md`/`research` |
| 「图片转图纸」管线测试素材获取 | `document-skills:image_search` | 搜三类 fixture：实物照片图、数字像素画、带图例图纸；结果 URL 为 z-cdn 直链，可直接给视觉 MCP 分析 |
| 图像内容分析（主色/网格规格估计、fixture 质量评估、烫染预览截图验收、图库内容审核辅助） | `4_5v_mcp:analyze_image`（仅远程 URL） | 远程图用此工具；本地图片直接用 Read 内置视觉，不消耗额度 |
| px-creat-web 前端 GUI 测试（dev server 起来后：路由、SSR 产物、编辑器交互、性能直觉检查） | `browser-use` 技能（`node_repl`） | 走 web-gui-tester 黑盒流程，截图留档任务目录 |
| 渲染类交付物视觉验收（pptx/docx/xlsx/pdf/图表） | `document-skills:judge` 子代理 | 唯一视觉验收关口，不与人工预检重复 |
| uniapp H5/App 端联调（P1） | `android-emulator` 插件 | 装包、截图、UIAutomator 树、logcat 过滤 |
| 操作本机 GUI 工具（微信开发者工具等无 CLI 环节的场景） | `computer-use` | 语义优先、像素兜底；仅限开发自用场景 |

约定：MCP 调用产出（调研结论、fixture 清单、分析报告）属任务工件，写入 `.trellis/tasks/<task>/` 对应文件，不散落在会话里；新增对外 MCP 服务器须先在本节登记用途。

