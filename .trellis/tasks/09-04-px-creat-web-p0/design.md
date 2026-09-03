# 技术设计 · px-creat-web P0（总任务级）

子任务级设计在各自目录补 `design.md`；本文锁定跨子任务一致的技术契约。

## 技术栈定稿

| 层 | 选型 | 备注 |
| --- | --- | --- |
| 构建 | Vite + React 18 + TypeScript(strict) | 从零搭建，Node 20+ |
| 路由 | React Router 6，声明式 `<Routes>`：客户端 BrowserRouter / 预渲染 MemoryRouter 同构渲染 | 营销页 `/`、`/about` 与工具页 `/studio` 分区；原定"数据路由模式"弃用（2026-09-04 m0 视觉验收发现水合崩溃后定稿：无 loader/action 场景数据路由无收益，声明式与 SSR 同构保证水合一致） |
| 状态 | zustand（画布/工程状态） + 少量 context（主题） | 不引入 redux；M0 定稿后回写根 AGENTS.md |
| 样式 | Tailwind CSS v3，token 从 web-style 双图提炼（见「视觉风格基准」），lineone 仅作组件结构参考 | 设计 token 集中在 `tailwind.config.js` theme.extend |
| SEO | 营销页预渲染：M0 在 vite-plugin-prerender（静态导出时执行）与部署层 prerendering 之间定稿 | 工具页纯 CSR |
| 测试 | Vitest（lib/ 纯函数单测） | 转换管线、色彩科学必须有单测 |
| Worker | Web Worker（烫染渲染、大图转换） | 主线程禁止长任务 |

## 视觉风格基准（web-style 双图）

视觉权威参考：`px-creat-web/web-style/bocchi the rock.jpg`（粉色主题）与 `Miku UI Design.jpg`（青色主题）。两图为**同一版式骨架、不同主题色**，整站 token 从中提炼：

- 版式（营销页）：居中导航 Header + 大圆角横幅 Hero（角色插画出血于横幅边缘）+ 三栏内容（贴纸卡片网格 / 搜索 pill 标签 / 侧栏列表与 CTA 卡）
- 形状：卡片圆角 24–32px，按钮全 pill，缩略图 12–20px，soft 低透明度阴影
- 配色：近白底 + 白卡片 + 主题色粉彩渐变 Hero，高饱和色仅点缀；**双主题切换**（默认 Bocchi 粉，可切 Miku 青，theme store 管理，2026-09-04 定稿）
- 字体：圆润无衬线（Poppins/Nunito 类），大号加粗展示标题
- 装饰：动漫角色出血插画、chibi 贴纸卡片、心形涂鸦、像素风徽章（呼应拼豆像素属性）

lineone 的角色降级为**组件结构参考**：Modal/Drawer/Tabs/Table 等的结构与交互形态可复刻，其 navy 色阶与后台管理气质不得进入整站 token。编辑器等工具页信息密度高，可借用 lineone 式组件结构，但配色/圆角/字体仍走本基准，避免后台管理系统观感。

## UI 视觉产出工作流

需要视觉模型（GLM-5.3-flash）生成/设计页面 UI 时，调用会话 `sess_e96db654-c0c6-4231-8e6e-de152fb67575` 执行；其产出落地进工程后仍须过 `tsc --noEmit`、生产构建，并对照双图做视觉走查。

## 目录契约（各子任务共同遵守）

```text
px-creat-web/
  src/
    lib/            纯函数库，禁止 import React：types.ts / color.ts / palettes.ts /
                    converter.ts / patternSheet.ts / storage.ts / analytics.ts(留位)
    components/     通用 UI（Button/Card/Dialog/Drawer…，lineone 复刻）与编辑器组件分目录：
                    components/ui/（通用）、components/editor/（CanvasStage、ToolRail、PalettePanel、StatsPanel…）
    pages/          路由页面：marketing/（可预渲染）、studio/（编辑器 CSR）
    store/          zustand stores（project.ts、editor.ts、theme.ts）
    data/           色板 CSV（构建期内置，唯一权威来源）
  public/
```

## 核心数据契约

- 工程 JSON schema 对齐文档 §4.8：`{v, title, brandKey, w, h, cells[], finish{preset,intensity}}`；cells 为色板索引数组，-1 空格。**schema 变更必须回写父任务 prd.md 与根 AGENTS.md**。
- 色板数据结构：`BeadColor { brand, code, name, rgb, colorType? }`；特殊效果色带 `colorType` 标记，默认不参与自动匹配。
- BOM 行结构预留 `brand/code/count` 字段（P1 商业映射）。
- 存储分层（2026-09-04 定案）：localStorage 只存工程数据（cells 等小体积），参考图存 IndexedDB；导出的工程 JSON 内嵌参考图保证可迁移，导入时优先取内嵌图。
- lib/ 层所有公开函数有显式类型签名与 TSDoc，作为 UI 层唯一调用入口。

## 性能预算（跨任务红线）

- 任何 >50ms 的计算不得在主线程同步执行（Worker 或分片）
- 烫染效果是渲染层属性，永不修改 cells 数据
- 撤销栈 100 步，自动保存 30s 周期，均不得阻塞绘制
