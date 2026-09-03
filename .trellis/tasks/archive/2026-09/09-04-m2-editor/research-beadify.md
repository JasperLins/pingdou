# 竞品调研 · Beadify（beadify.app）编辑器创作方式

> 调研目的：为 m2-editor（绘制工具模块）取其精华、去其糟粕。方法：浏览器实测编辑器（用户提供的 compare 视图链接，项目数据未加载，画布为空，但完整 UI/面板/工具均可见）+ 官网功能与定价页 + 用户提供的 compare 视图截图。调研日期 2026-09-04。

## 1. 编辑器全景（实测）

### 1.1 布局分区

- **左栏（配置流）**：Source（Library 资产库 / Import JSON / Upload）→ Configuration（品牌下拉：Perler/Artkal/Hama/Nabbi/Yant；口径下拉：Midi 5mm/Mini 2.6mm/Caps 5mm）→ Pattern size → Palettes → Advanced → **Update Grid**（显式应用按钮）
- **中央**：画布（Pattern 视图）/ 源图对照（Compare 视图）/ 拼制跟踪（Crafting 视图），三种视图模式切换
- **右栏**：图纸统计（Pattern/Details 两个页签）+ Export
- **底部**：Current Color 当前色 + Quick Palette 快捷色板（约 24 个常用色一排）+ 完整色板
- **左下竖排工具栏**：Hand/Pan、Move、Pick Color、Pencil、Eraser、Delete Color、Swap Colors、Undo/Redo、More（Reset Changes / Flip Horizontal / Denoise-Clean）
- 侧栏可整体折叠（Focus 模式）；通知用 toast（alt+T 唤起）

### 1.2 尺寸体系（板子导向）

- "Board layout"模式：按物理板选尺寸（Midi 29 / Mini 57 / Mini 50），口径与板型联动（选 2.6mm 后 Midi 29 自动禁用并给原因）
- 宽高步进器（板数单位），实时显示 **board coverage（1×1 板覆盖）与物理尺寸（14.8×14.8 cm）**
- "Exact size"（任意精确尺寸）为 **Pro 付费功能**

### 1.3 色板体系

- 当前品牌 41 色激活；**Limit to Stash**（限定个人库存色）/ Mix Brands（混品牌，Pro）/ stash-only 三个开关
- 三分类管理：**Used colors（已用）/ Generation（参与生成的激活色）/ Excluded（已排除色）**，各自可 View/Manage
- 排除色号直接影响转换匹配（不想用的色从匹配候选里剔除）

### 1.4 转换质量面板（Advanced）

| 参数 | 选项 | 与我们对照 |
| --- | --- | --- |
| Sampling | Pixel art（默认）/ Photo | = 我们的 卡通（众数主导）/ 平滑（区域平均），命名更直白 |
| Cleanup | Off（默认）/ Light | 转换后自动去噪（孤立碎色清理），我们没有 |
| Color matching | **Lab（默认）**/ CIEDE2000 | 与我们相反：我们调研定案 CIEDE2000 默认（暗色/黄色区感知更准） |
| Dithering | Off（默认）/ Floyd-Steinberg / Atkinson | 我们默认关一致；P1 才开抖动 |
| Image adjustments | 亮度等（无图时禁用） | 与我们转换参数面板一致 |

关键交互：改配置不立即重转，需点 **Update Grid** 显式应用——避免重渲染风暴，但配置与结果割裂。

### 1.5 视图三模式

- **Pattern**：编辑视图（工具+色板）
- **Compare**：源图与图纸并排对照（用户截图所示：左照片右图纸），满意才应用
- **Crafting**：拼制跟踪——**聚焦单色逐色拼、标记已放的豆子、进度可重置且不动图纸**，进度云同步（免费手动 10 项目 / Pro 自动 500）

### 1.6 导出与商业模式

- 导出五通道：Image（PNG/JPEG/WebP）、**PDF Pack（Pro：多板 1:1 比例 + 完整购物清单 + 作者名）**、SVG、XLSX Workbook、JSON Backup；图纸带**行号印刷**（每行印色号）
- 免登录可创作，**导出需登录**；Free 档硬限制：**每日 3 次导出、单板、≤16 色、1280px、水印**；Pro $79/年解锁无限导出/多板/2K-4K/去水印
- 账号体系：Dashboard 工作台、Image Assets 源图资产库（50/1000 张）、云同步（含冲突副本 [conflict] 机制）
- AI 功能：AI 清理预览、AI 生成源图（积分制）

## 2. 取其精华（建议采纳）

| # | 功能 | Beadify 做法 | 建议去向 | 成本 |
| --- | --- | --- | --- | --- |
| 1 | **Swap Colors 两色互换** | 工具栏一键 A↔B 互换 | m2 P0（与全局换色同面板，we 只有单向替换） | 低 |
| 2 | **Quick Palette 常用色快捷行** | 底部 24 常用色一排直选 + Current Color 大色块 | m2 P0（配合已有"最近使用"） | 低 |
| 3 | **物理规格反馈** | 实时显示 cm 尺寸 + 板覆盖数 | m2 P0（新建对话框与状态栏，规格 5mm/2.6mm 换算） | 低 |
| 4 | **一键去噪 Denoise/Clean** | More 菜单 + 转换 Cleanup 选项 | 建议讨论：m2 P0（孤立单格自动清理，服务 Q3 碎色<5%）或 m7 | 低（lib 纯函数） |
| 5 | **整图翻转 Flip** | More 菜单水平翻转 | m7（对镜面构图有用，低成本） | 低 |
| 6 | **Reset Changes 回到生成结果** | 放弃全部手改回到上次 Update Grid | m7（撤销栈之外的安全网） | 低 |
| 7 | **Compare 常驻对照视图** | 编辑器内视图模式，不只转换时 | m7（转换对话框内对照 P0 已有；常驻化为编辑器视图是增强） | 中 |
| 8 | **Crafting 跟拼模式** | 聚焦单色、标记已放豆、进度独立重置、云同步 | **P1**（对齐需求 §5.5 小程序跟拼模式，Web 端先做本地版亦可） | 中 |
| 9 | **排除色号（Excluded）** | 从匹配候选剔除不想用的色 | P1（与 targetColors 互补：targetColors 控数量、排除控具体色号） | 低 |
| 10 | **Stash 库存感知色板** | 转换前勾选已有豆色，围绕库存过滤 | P1+（对齐豆库管理 §5.3 与商城路径，需账号体系） | 高 |
| 11 | **导出行号印刷 / PDF 多板清单** | 每行印色号、PDF 1:1 多板+购物清单 | m5 版式对照时参考（行号标注）；A4 分页已在 m7 | 中 |
| 12 | 板型口径联动禁用 | 选 2.6mm 自动禁用 5mm 板并说明 | m2 新建对话框借鉴（规格↔板型联动提示） | 低 |

## 3. 去其糟粕（不采纳，及理由）

1. **Free 档硬限制（16 色 / 单板 / 每日 3 次导出 / 水印）**——与"不限制色号使用"的产品口径正面冲突；我们 P0 纯前端本地运行，无水印无配额，这是差异化不是损失。
2. **配置与画布割裂 + 术语直出**——左栏五段折叠配置 + 显式 Update Grid，CIEDE2000/Atkinson 等术语直接暴露给用户，新手门槛高。我们保留"生成类型=选作品的样子"预设心智 + 转换对话框集中调参，高级项收折叠区。
3. **导出强制登录**——我们 P0 无账号，导出是本地权利；登录诉求留给 P1 云图库。
4. **默认 Lab 色差**——竞品默认 Lab（近似 CIE76）CIEDE2000 反而是可选项；我们调研（§4.3.4）与同类工具实践支持 CIEDE2000 默认（暗色/黄色区感知失真是实锤痛点），维持定案。
5. **无中文、无 MARD/COCO 本土色板**——我们的本土供给优势，保持五品牌 1,386 色。

## 4. 对规划工件的落地建议

- 采纳项 1/2/3/12 → 写入 m2-editor prd.md Requirements（P0 小增量）
- 采纳项 4（去噪进 P0 还是 m7）与 8（Crafting 排期）→ 需用户拍板
- 采纳项 5/6/7 → 追加进 m7-p1-batch 候选清单
- 采纳项 9/10 → features.md 标注 P1/P1+ 方向（对齐既有需求章节）
- 采纳项 11 → m5-export Notes 记一笔"版式对照时评估行号标注"

## 5. 登录态补充调研（2026-09-04 第二轮，实测转换全流程）

用户 Google 登录后解锁 Dashboard 与真实数据流。编辑器通过页面内合成测试图（128×128 像素风头像）注入上传，完整跑通 转换→对照→导出面板。

### 5.1 Dashboard（Library 工作台）

- 左侧导航：Create / Library（Overview、All Patterns、Image Assets、**Inventory**、Account）、AI 积分（5 available + Top Up）、Free Plan 标识、Upgrade to PRO
- **创作管线三段式**：Image Assets（收集源料）→ Pattern Projects（编辑图纸）→ Exports / Showcases（产出展示），每段带数量
- **Next actions** 待办区："Images not converted（源图未转图纸）"、"Pending cloud sync（待云同步）"——引导用户回到未完成工作
- 项目文件夹（免费 3 个）、搜索 + 排序、云同步配额（免费 10 个项目，"Synced projects 0/10"）

### 5.2 Inventory 库存管理页

- 按 品牌 × 口径（Perler Midi 5mm 等）逐色勾选拥有色，勾选项云同步（"0 selected in cloud"）
- Filter 色号过滤、Stash Only 只看已勾选、"Review cloud changes" 云端变更审核流（多端同步冲突处理）
- 勾选的色供编辑器"Limit to My Stash"模式使用——库存数据与转换色板联动

### 5.3 编辑器实测（有图纸状态）

- **Pattern Inspector（右栏）**：Overview（Boards 1 / Grid 57x57 / Beads 3,249 / Colors 5）+ Setup（板型/尺寸/口径回显）+ **Readiness 导出前自检**（"No issues found"——问题检查清单化）+ **Top colors 色量榜**（Toothpaste x2052/63%，可点击定位）
- 画布带**数字标尺**（每 10 格 0/10/20…，横纵两轴）+ Hide guides 开关 + Maximize 全屏；珠子渲染为圆点带高光
- **Compare 视图**：Split 分屏 / Overlay 叠加 两种对照模式；右栏切换为 **Source tuning 源图调优**——亮度/对比度/饱和度/**灰度** 四滑杆 + Reset/Cancel/**Update Pattern**（调完重转）；视图状态写入 URL（?view=compare，可回传）
- **Crafting 视图始终禁用**（未保存工程时），推测需先保存/云同步——跟拼进度是云端对象
- 教训级发现：**编辑态是内存态**——带图纸状态下直接跳转 view=pattern 即丢全部工作（源图+图纸清空）；本地无自动保存兜底（Dashboard 的"Pending cloud sync"暗示手动/延迟同步）。我们的 30s 自动保存 + IndexedDB 分层存储方案显著优于它

### 5.4 Export 对话框（实测）

- 顶部配额："3 / 3 remaining today · Resets in 5h 49m"（每日导出配额+重置倒计时）
- 五通道：PDF Pack（打印版图纸页）/ Image Export（**Pattern sheet 带图例版式 或 Pattern only 纯图版式**）/ SVG（矢量格子+标注）/ XLSX（**图纸表+库存表**）/ JSON Backup
- Image 选项：预览缩略图实时切换；File format（PNG 等）；**Resolution：Standard 1280px（免费）/ 2K / 4K（Pro）**；**Cell labels：Number（格子上印色号）**；**Legend position：Auto**；**Show color names** 开关（默认关保图例紧凑，色号仍显示）
- Advanced：**Author 署名字段** + **Beadify watermark 水印开关（免费档强制勾选）**
- **Share to Community**：Publish to Showcase + **"Earn credits: approved works get rewards (max 3/month)"**——过审作品奖 AI 积分的 UGC 激励飞轮

### 5.5 第二轮采纳候选（用户已确认）

**2026-09-04 用户确认：采纳 B（→m2）、C（→m5）；不采纳 A（灰度滑杆）、D（画布标尺）。**

| # | 项 | 来源 | 建议去向 | 成本 |
| --- | --- | --- | --- | --- |
| A | 灰度滑杆（转换参数） | Source tuning | m3（亮度/对比/饱和度之外 +1） | 低 |
| B | **Readiness 导出前自检**（色号有效/无孤立碎色/无待确认映射/统计完整，问题清单化） | Pattern Inspector | m2（StatsPanel 顶部） | 低 |
| C | 图纸 PNG 版式选项：**Pattern sheet（带图例）/ Pattern only（纯图）双版式 + Cell labels 色号格子标注选项 + Author 署名** | Export 对话框 | m5（版式需求增强） | 中 |
| D | 画布数字标尺（每 5/10 格，横纵轴） | 画布 | m7 | 低 |
| — | Dashboard 创作管线/文件夹/Next actions | Dashboard | P1 图库工作台参考（方向记录） | — |
| — | Showcase + 积分激励 | Share to Community | P1 UGC 激励参考（对齐 §5.2 上架收益） | — |
| — | XLSX 图纸+库存表 / SVG 矢量导出 | Export | P1+（方向记录，P0 不做） | — |

明确继续不采纳：每日导出配额与倒计时、水印（免费强制）、分辨率付费墙——维持"本地运行、无限制、无水印"差异化。

## 附：实测局限

- 第一轮：项目链接未带数据、IAB 不支持文件上传
- 第二轮已实测：转换全流程、Compare/Source tuning、Export 对话框、Inventory、Dashboard；**未实测**：实际导出下载内容（PDF/XLSX 内页）、Crafting 视图交互（需已保存工程）、Pro 功能（Exact size/Mix Brands/2K4K）
