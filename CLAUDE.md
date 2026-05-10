# BiuBiu English 前端项目

## 项目简介
面向中国女性（21-35岁）的英语学习平台，通过 YouTube vlog 视频配合字幕工具学习英语。

## 技术栈
- React + Tailwind CSS + Vite
- 本地开发：`npm run dev`（端口 5173）
- 部署：GitHub push 后自动部署到阿里云 OSS（GitHub Actions）
- 后端 API：`https://api.biubiuenglish.com`（阿里云 FC，需手动部署）

## 核心文件
| 文件 | 职责 |
|------|------|
| `src/pages/VideoDetail.jsx` | 视频详情页，最核心最大的文件。包含跟读区域（ShadowCard/ShadowPanel）、录音逻辑、播放控制等 |
| `src/components/SubtitleItem.jsx` | 字幕行组件，PC 端字幕列表中每一行。注意：手机端跟读区域的按钮逻辑在 VideoDetail.jsx 里，不在这个文件 |
| `src/utils/recordingStorage.js` | 录音 IndexedDB 存储工具类 |
| `src/services/api.js` | 后端 API 封装 |

## 字幕模式
PC 端 Tab：双语 / 英 / 中 / 精读 / 听写 / 挖空 / 词卡
手机端主 Tab：双语 / 跟读 / 听写 / 词卡（其余在「更多」里）

## 数据存储规则
- 用户偏好（字体大小、主题等）→ localStorage
- 录音数据 → IndexedDB + 内存 ref 缓存（recordingCacheRef）
- 笔记数据 → 服务器（跨设备同步）

---

## ⚠️ 踩坑记录（务必阅读）

### 1. iOS Safari audio.play() 必须在同步调用栈内
**问题**：用户点击播放 → 异步读 IndexedDB → play()，iOS 拒绝播放，报错 "The request is not allowed by the user agent"
**原因**：iOS Safari 要求 audio.play() 在用户手势的同步调用栈内执行，中间不能有 await/异步操作
**解决**：录音 Blob 缓存在内存 ref（recordingCacheRef），播放时同步取用，IndexedDB 仅做持久化备份
**规则**：任何需要用户手势的 API（play()、录音等），都必须保持同步调用链，中间不能插入 await

### 2. IndexedDB 不支持直接存 Blob
**问题**：录音存 IndexedDB 报错 "Error preparing Blob/File data to be stored in object store"
**解决**：存之前先转为 ArrayBuffer（blob.arrayBuffer()），读出来后再转回 Blob

### 3. 手机端 vs PC 端函数名不同
**问题**：手机端"我的录音"按钮在 VideoDetail.jsx 的 ShadowCard 里，调用的是 `handlePlayMyRec`；PC 端字幕行在 SubtitleItem.jsx 里，调用的是 `handlePlayMyRecording`。两个是完全不同的函数。
**规则**：改录音/播放逻辑时，必须确认改的是哪个函数，手机端和 PC 端都要检查

### 4. H.264 视频要求偶数像素
ffmpeg 输出 H.264 编码视频时，宽高必须是偶数，否则编码失败。加 `-pix_fmt yuv420p` 保证兼容。

### 5. PWA Service Worker 阻碍更新
网站有 registerSW.js，会缓存旧代码导致用户拿不到新版本。已加入强制注销 SW 脚本。后续考虑彻底删除 PWA。

### 6. Tailwind v4 配置在 CSS 文件里，不读 tailwind.config.js
**问题**：项目用的是 Tailwind v4（`@import "tailwindcss"` + `@custom-variant` + `@theme` 是 v4 语法）。改 `tailwind.config.js` 的 `theme.screens` 完全没效果。
**原因**：v4 默认不读 `tailwind.config.js`，breakpoints 必须写在 CSS 文件里的 `@theme` 块或用 `@custom-variant` 定义。
**解决**：在 `src/index.css` 里用 `@custom-variant {name} (...)` 定义/覆盖断点。例如让 `xl:` 同时要求宽度 + 横屏：
```css
@custom-variant xl (@media (min-width: 1024px) and (orientation: landscape));
```
**规则**：改 Tailwind 断点 / 自定义 variant 一律改 `src/index.css`，不改 `tailwind.config.js`。

---

## CC 工作规范

### 修改范围控制
- 只改指定的文件和函数，不要动其他模块
- 手机端和 PC 端要同时考虑，改一个别忘另一个
- 改录音/播放相关代码时，确认 VideoDetail.jsx（手机端）和 SubtitleItem.jsx（PC 端）的对应函数

### Debug 时
- 手机端调试用 alert()（硬编码，不依赖 isDebug），不要用 console.log
- alert 放在函数绝对第一行，在所有 if/return 之前
- 修完 bug 后记得清掉所有 debug alert
