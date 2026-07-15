# 项目状态与 AI 接手指南

> 最后核对：2026-07-15
> 当前阶段：本地功能型 MVP 已完成主要技术债优化，具备 Git 历史、确定性基线和自动回归。
> 发布判断：本地学习/演示可用；真实移动设备和 PWA 验收未完成，字体与品牌素材授权仍阻断公开分发。

## 1. 给下一位 AI 的快速结论

这是一个纯静态 Vue 3 PWA，无运行时构建步骤。模板在 `index.html`，样式在 `css/app.css`，业务逻辑在 `js/app.js`。依赖、字体和图片均为本地文件，正常运行不依赖 CDN。

接手时按顺序阅读：

1. 本文件：当前进度、真实风险和修改规则。
2. `README.md`：运行、功能、数据和测试命令。
3. `tests/MANUAL_REGRESSION.md` 与 `tests/e2e/app.spec.mjs`：已有验收边界。
4. `js/app.js`：状态、IndexedDB、备份、排序和导出逻辑。
5. `index.html` 与 `css/app.css`：模板和视觉实现。
6. `ASSET_PROVENANCE.md` 与 `THIRD_PARTY_NOTICES.md`：公开发布阻断项。

项目已经初始化 Git，分支为 `main`。仅本项目配置的提交身份为 `项目开发者 <developer@local>`；这是本地占位身份，不代表真实作者或远程平台账号。

## 2. 当前已实现

- 三页式移动界面：`首页 / 编辑器 / 预览分享`，由 `activePage` 切换。
- 浅色/深色主题、状态栏、我的资料与三位对方的昵称/头像设置。
- 聊天标题无 `maxlength` 和换行，使用独立居中层避开两侧控件；超出可用宽度时按实际渲染宽度等比缩小，预览与导出使用同一布局。
- 每条用户消息使用 `senderId` 在“对方1/2/3（动态显示真实昵称）/是我发出的”之间单选，群聊预览匹配对应头像与昵称。
- 文字、图片、语音、转账、通话、拍一拍、时间戳、红包八类消息。
- 消息添加、编辑、删除；鼠标拖动手柄与触屏上/下移动兜底。
- 固定 `375 × 812` 聊天预览，3 倍像素导出为 `1125 × 2436` PNG。
- 单一图片生成管线；同一生成结果分别用于下载和 Web Share 文件分享。
- 状态 schema 3、旧单聊自动映射到对方1、v18→v19 安全迁移、图片压缩和 IndexedDB 二进制存储。
- JSON 便携备份导出/导入，备份内联引用图片。
- PWA Manifest、Service Worker v32 核心缓存、主屏幕图标和 IIS 配置。
- 143 项静态检查、固定 PNG 视觉基线和 5 项 Playwright Chromium 回归。
- Cloudflare Workers 静态资源配置与 `.assetsignore`，避免部署时上传 `node_modules/workerd`。

## 3. 技术结构

| 项目 | 当前实现 |
| --- | --- |
| 应用形态 | 纯静态单页 PWA |
| 框架 | Vue `3.5.35`，本地生产版全局脚本 |
| 模板 | `index.html`，约 621 行 |
| 样式 | `css/app.css`，约 1180 行；另有 Tailwind `3.4.17` 本地编译 CSS |
| 业务逻辑 | `js/app.js`，约 1273 行 |
| 截图 | 本地 `html-to-image` + Canvas 图片覆盖层重绘 |
| 文本状态 | `localStorage` 键 `wechat_editor_state_v19` |
| 图片状态 | IndexedDB `wechat_screenshot_pwa_assets` / store `assets` |
| 构建 | 运行无需构建；测试依赖 npm |
| 自动化 | `scripts/check-project.mjs` + Playwright `1.61.1` |
| PWA | `manifest.webmanifest` + `sw.js`，缓存 v32 |
| Cloudflare | `wrangler.jsonc`，根目录静态资源；`.assetsignore` 排除开发依赖和测试文件 |

核心数据流：

```text
用户编辑
  -> Vue 响应式状态
  -> 图片压缩后写入 IndexedDB / 文本与资源 ID 写入 localStorage
  -> 聊天预览即时更新
  -> html-to-image 生成基础图 + Canvas 重绘图片覆盖层
  -> 单一 PNG Data URL
  -> 下载或系统文件分享
```

## 4. 状态、迁移与备份

- `CURRENT_STATE_SCHEMA = 3`。
- 三位对方保存在 `opponents` 数组，固定 ID 为 `other1/other2/other3`；消息通过 `senderId` 记录发送人，兼容字段 `isMe` 会同步写入。
- 旧状态中的 `otherName/otherAvatar/otherAvatarAssetId` 自动迁移为 `opponents[0]`，旧 `isMe` 消息自动换算为 `senderId`。
- 当前键为 `wechat_editor_state_v19`；旧键 `wechat_editor_state_v18` 只在新状态保存成功后删除。
- `normalizeState()` 过滤异常根值，并补齐默认字段；消息对象会复制后再使用。
- `migrateInlineImagesToAssets()` 把旧 Data URL 图片写入 IndexedDB；失败时保留内联图片回退。
- `hydrateStateAssets()` 在加载后把资源 Blob 转回预览所需 Data URL。
- 头像最长边 1024 px，消息图最长边 1600 px；透明图片优先保留 PNG，其余图片可使用 WebP/JPEG 压缩回退。
- 便携备份格式为 `wechat-screenshot-pwa-backup` version 1；导入会覆盖当前编辑内容。
- 生成 PNG 不持久化，刷新后需要重新生成，这是设计行为。

修改状态字段时必须同时检查：`defaultState`、`normalizeState()`、`createStateSnapshot()`、watcher、备份导入/导出、旧 schema 迁移和 Playwright fixture。

## 5. 图片导出链路

当前只有一条主流程：

1. `generatePreparedImage()` 切到预览页，最多尝试生成三次。
2. `createExportImageDataUrl()` 等待字体和图片，收集图片覆盖层并暂时隐藏原图。
3. `html-to-image.toPng()` 以 `pixelRatio: 3` 生成基础图。
4. `paintImageOverlays()` 按裁剪、圆角、透明度和 `object-fit` 重绘头像/聊天图片。
5. `ensureGeneratedImageDecoded()` 确认 PNG 可解码后写入 `generatedImageUrl`。
6. `downloadGeneratedImage()` 或 `shareGeneratedImage()` 使用同一结果；内容变化会标记 `generatedImageDirty` 并阻止使用旧图。

旧的 `generateImage()`、`shareOrDownloadImage()` 和 DOM 替换式图片栅格化流程已经删除。修改预览 DOM、字体、图片尺寸或圆角后，必须重跑实际 PNG 生成测试。

## 6. 验证基线

安装测试依赖后执行：

```bash
npm install
npx playwright install chromium
npm test
```

2026-07-15 的结果：

- 143 项项目检查通过：JS/Manifest/SW/Wrangler 语法、资源存在性、PWA 缓存、部署排除规则、群聊参与者、单行自适应标题、schema、依赖与 fixture 等。
- 5 项 Playwright Chromium 测试通过：迁移/导航、三位群聊成员与消息发送人持久化、排序、390 px 移动布局、标题单行居中/超长缩放、PNG/备份下载。
- 浏览器人工回归通过三页、八类消息、深浅色、编辑持久化、390×844 与 412×915 布局。
- 固定导出图为 `1125 × 2436`；相对既有视觉基线仅 841/2,740,500 像素变化（约 0.031%，平均通道差 0.0047）。
- 图片压缩 fixture：`480 × 320`/24,620 字节 → `160 × 107`/5,604 字节，并通过 IndexedDB 写读。

详细记录在 `tests/MANUAL_REGRESSION.md`。测试无法替代真实设备验收。

## 7. 仍存在的风险与技术债

### 发布阻断（P0）

1. `fonts/` 中 Apple SF Pro、WeChat 命名字体和来源不明 SansStd 字体没有随附授权证明。
2. `pic/` 和部分 `assets/` 仿微信/iOS 素材没有来源记录，另有商标与界面仿制风险。
3. `vendor/html-to-image.min.js` 没有嵌入版本或许可证头；虽可确认上游项目使用 MIT，仍需以锁定版本的官方文件替换或补齐取得记录。

处理要求见 `ASSET_PROVENANCE.md` 和 `THIRD_PARTY_NOTICES.md`。在这些项关闭前，不要声称项目已经获得公开分发授权。

### 验收缺口（P1）

1. 尚未在真实 iPhone Safari 和 Android Chrome 验证触摸排序、文件选择、下载/分享、PWA 安装、缓存升级和完全离线启动。
2. Web Share 只验证了能力检测和文件构造，没有自动打开/完成原生分享面板。
3. 大尺寸、EXIF 方向、超长聊天和浏览器存储压力仍缺少真实样本测试。
4. 尚未完成屏幕阅读器、键盘全流程和颜色对比度审计。

### 可维护性（P2）

1. `js/app.js` 仍是单个约 1200 行脚本；后续可按存储、导出、排序和 Vue 应用拆分为无构建 ES modules。
2. Vue 模板仍集中在 `index.html`；若产品继续增长，可逐步组件化，但必须保留当前确定性导出基线。
3. 当前只有本地测试，没有远程仓库和 CI；添加远程后应建立 `npm test` 的持续集成。
4. 测试当前只覆盖 Chromium；Safari/WebKit 和 Firefox/Edge 仍需策略与基线。

## 8. 后续推荐顺序

1. 获取字体/图片的可分发授权；无法取得时，改为系统字体与自制中性图标，并重新建立视觉基线。
2. 在一台真实 iPhone 和一台 Android 设备完成 PWA/上传/排序/导出/分享验收并记录版本。
3. 增加大图、超长消息、存储不足和备份损坏等异常回归。
4. 把 `js/app.js` 拆成 storage/export/sort/app 模块；每次只拆一层并运行 `npm test`。
5. 有远程仓库后增加 CI，再考虑 WebKit/Firefox 自动化矩阵。

## 9. 后续 AI 修改规则

- 修改前说明涉及模板、样式、状态存储、导出或 PWA 缓存中的哪些层。
- 不删除来源不明资源来“顺手清理”；先确认引用，再按 `ASSET_PROVENANCE.md` 的替换方案执行。
- 修改状态结构时新增 schema 迁移，不要只改存储键。
- 修改静态资源时检查 `sw.js` 的 `CORE_ASSETS` 并提升 `CACHE_NAME`。
- 修改 Cloudflare 资源目录时同步检查 `.assetsignore`；绝不能把 `node_modules` 作为静态资源上传。
- 修改导出相关 DOM/CSS 后必须实际生成 PNG；只看页面预览不算完成。
- 完成一批工作后运行 `npm test`、`git diff --check`，更新本文的验证、风险和进度记录。
- 不要把 `developer@local` 当作用户真实邮箱，也不要未经用户确认配置全局 Git 身份或远程仓库。

## 10. 关键提交与进度记录

| 提交 | 内容 | 验证 |
| --- | --- | --- |
| `709f0ec` | 建立 Git 项目基线与本地身份 | 静态文件基线 |
| `4b24f1a` | 固定 fixture、PNG 基线和项目检查 | 确定性静态检查 |
| `606a27c` | 记录桌面/移动浏览器回归 | 三页、八消息、导出与视口 |
| `b461658` | 增加专用拖动手柄和上下移动兜底 | 排序与持久化回归 |
| `24fdb56` | 图片压缩、IndexedDB、迁移和备份 | 迁移/压缩/备份浏览器回归 |
| `e0aa2cf` | 统一生成、下载和系统分享 | 1125×2436 与下载文件验证 |
| `305a6ab` | 拆分 CSS/JS，PWA 缓存升至 v30 | 资源加载和像素基线 |
| `ca8d8ce` | 增加 Playwright 自动回归 | 119 checks + 4 E2E |
