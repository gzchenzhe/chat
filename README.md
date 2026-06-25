# 微信截图编辑器 PWA

一个三页面 PWA 版本的微信聊天截图编辑器。当前版本保留原项目的 UI 和功能逻辑，将功能拆分为“首页 / 编辑器 / 预览分享”三个页面，并支持添加到手机主屏幕使用。

> 仅用于学习、演示、设计稿预览等正当场景。请勿用于伪造证据、冒充他人或误导传播。

## 页面展示

![微信截图编辑器 PWA 三页面展示](assets/showcase.png)

## 页面结构

- 首页：全局外观、人物设置。
- 编辑器：聊天内容编排，支持添加、编辑、拖拽排序各类消息。
- 预览分享：查看微信聊天预览图，并执行重置或导出截图。

## 功能

- 支持浅色/深色模式。
- 支持编辑手机时间、返回标识、聊天标题、未读数、电池电量、网络标识。
- 支持设置双方头像、对方昵称、是否显示昵称。
- 支持消息类型：
  - 文字
  - 图片
  - 语音
  - 转账
  - 通话
  - 拍一拍
  - 时间戳
  - 红包
- 支持拖拽调整聊天内容顺序。
- 支持本地自动保存编辑状态。
- 支持导出高清 PNG 截图。
- 支持 PWA 安装到手机主屏幕。

## 目录

```text
PWA/
├── index.html                # PWA 主页面
├── manifest.webmanifest      # PWA 名称、图标、启动方式配置
├── sw.js                     # Service Worker 离线缓存
├── README.md                 # 项目说明文档
├── assets/
│   ├── showcase.png          # 三页面展示图
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── fonts/                    # 字体资源
├── pic/                      # 微信/iOS 界面素材
├── vendor/                   # Vue、Tailwind、html-to-image 等本地依赖
└── web.config                # IIS 部署配置
```

## 本地预览

进入 `PWA` 目录后启动静态服务：

```bash
python -m http.server 8188
```

访问：

```text
http://127.0.0.1:8188/
```

## 添加到主屏幕教程

### iPhone / iPad Safari

1. 用 Safari 打开 PWA 网址。
2. 点击浏览器底部的“分享”按钮。
3. 在分享菜单中选择“添加到主屏幕”。
4. 确认名称和图标。
5. 点击“添加”。
6. 回到主屏幕后，点击图标即可像 App 一样打开。

### 安卓 Chrome

1. 用 Chrome 打开 PWA 网址。
2. 点击右上角三个点菜单。
3. 选择“添加到主屏幕”或“安装应用”。
4. 确认名称和图标。
5. 点击“添加”或“安装”。

### Edge / Chrome 桌面端

1. 用浏览器打开 PWA 网址。
2. 地址栏右侧如果出现安装图标，点击安装。
3. 或打开浏览器菜单，选择“应用 / 安装此站点为应用”。

## 主屏幕名称与图标

主屏幕显示名称主要在这里修改：

```json
// manifest.webmanifest
"name": "微信截图 PWA",
"short_name": "截图PWA"
```

iOS Safari 还会读取：

```html
<!-- index.html -->
<meta name="apple-mobile-web-app-title" content="微信截图 PWA">
<title>微信截图 PWA</title>
```

主屏幕图标文件位于：

```text
assets/apple-touch-icon.png
assets/icon-192.png
assets/icon-512.png
```

## 缓存更新说明

PWA 使用 `sw.js` 做缓存。修改 `index.html`、图标、素材或样式后，如果手机主屏幕仍显示旧版本，可以：

1. 关闭主屏幕 App 后重新打开。
2. 在 Safari 中刷新一次网页。
3. 必要时删除主屏幕图标后重新添加。
4. 开发时可修改 `sw.js` 中的 `CACHE_NAME` 版本号，强制刷新缓存。

## 部署建议

- 推荐部署到 HTTPS 域名，PWA 安装和 Service Worker 在 HTTPS 下兼容性最好。
- 如果部署到 GitHub Pages、Vercel、Netlify 等静态站点服务，直接上即可。
- 如果部署到 IIS，可保留 `web.config`。

## 注意事项

- 所有数据保存在当前浏览器的 `localStorage` 中。
- 更换浏览器或清理浏览器数据后，编辑内容会丢失。
- 导出图片依赖浏览器对 Canvas、字体、图片跨域加载的支持。
- 本项目素材和截图样式仅用于合法用途。
