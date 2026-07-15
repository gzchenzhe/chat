# 第三方软件声明

最后核对：2026-07-15。本文记录软件依赖，不覆盖 `fonts/`、`pic/` 和展示图片；这些资源见 [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md)。

## 随运行时分发

| 本地文件 | 识别结果 | 许可证状态 | SHA-256 |
| --- | --- | --- | --- |
| `vendor/vue.global.prod.js` | Vue 3.5.35；文件头自带版本、版权和 MIT 标记 | 已识别；发布时保留原文件头和本声明 | `49eaae7627e2978abd894ac95f8b0240954fedd397b154c924f1c43dae373bfa` |
| `vendor/tailwind-local.css` | Tailwind CSS 3.4.17；文件内含版本和 MIT 标记 | 已识别；发布时保留内嵌注释和本声明 | `e25e42bea5dec650d994d2e5c561ddedff0a6ca0fd2f503c40f58748ab31bb58` |
| `vendor/html-to-image.min.js` | `html-to-image` UMD bundle；本地文件未记录版本或许可证头 | **待补证**：上游项目为 MIT，但应以锁定版本的官方构建替换并记录取得来源 | `8a724976a1594d38bedd545ffb8140ccb2ecd99deb76377719a9e6cdeec3ac1e` |

上游许可证：

- Vue core: <https://github.com/vuejs/core/blob/main/LICENSE>
- Tailwind CSS: <https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE>
- html-to-image: <https://github.com/bubkoo/html-to-image/blob/master/LICENSE>

### MIT License notice

The MIT License (MIT)

Copyright (c) 2018-present, Yuxi (Evan) You and Vue contributors  
Copyright (c) Tailwind Labs, Inc.  
Copyright (c) 2017-2026 W.Y. (applies to the identified upstream html-to-image project; local bundle version remains to be reconciled)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 仅开发/测试使用

| 依赖 | 当前版本 | 许可证 | 说明 |
| --- | --- | --- | --- |
| `@playwright/test` / `playwright` / `playwright-core` | 1.61.1 | Apache-2.0 | npm 开发依赖，不由静态 PWA 运行时加载；版本由 `package-lock.json` 锁定 |

Playwright 上游许可证：<https://github.com/microsoft/playwright/blob/main/LICENSE>。`node_modules` 不提交到 Git；重新安装依赖时由 npm 包携带对应声明。

## 维护要求

1. 升级或替换 `vendor/` 文件时记录准确版本、官方取得 URL、SHA-256 和许可证。
2. 不要通过“上游项目是开源的”推断一个来源不明二进制一定可分发；先完成文件与版本对应。
3. 如果公开构建包含新的第三方代码，必须在此补充声明，并按许可证要求保留版权/许可证文本。

本文是工程审计记录，不构成法律意见。
