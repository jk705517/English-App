# BiuBiu English 项目说明

## 项目简介
BiuBiu English 是一个面向中国女性（21-35岁）的英语学习平台，通过 YouTube vlog 视频配合字幕工具学习英语。

## 技术栈
- 前端：React + Tailwind CSS + Vite
- 主要文件：`src/pages/VideoDetail.jsx`（视频详情页，核心文件）
- 相关组件：`src/components/SubtitleItem.jsx`、`DictationInput.jsx`、`ClozeInput.jsx`、`IntensiveSentencePanel.jsx`
- 路由：React Router，视频页路由为 `/episode/:id`
- 本地开发：`npm run dev`（端口 5173）
- API：`src/services/api.js`，后端 `https://api.biubiuenglish.com`
- 录音存储：`src/utils/recordingStorage.js`，IndexedDB（biubiu-recordings）

## 当前字幕模式
双语 / 英文 / 中文 / 精读 / 听写 / 挖空 / 词卡（共7种）

## 已完成任务

### 第一阶段
- [x] 0A：详情页元数据移入「更多」面板
- [x] 0B：手机端播放器固定顶部，删除「继续播放」横条逻辑
- [x] 0C：手机端标题区精简
- [x] 1：视频页隐藏左侧导航栏
- [x] 2：词汇卡片移至右侧「词卡」Tab
- [x] 3：PC端字幕Tab重新排列（双语/英/中/精读/听写/挖空/词卡 + 设置图标⚙）
- [x] 补丁：播放器上方按钮移入视频内部（上一期/下一期/收藏/已学/更多叠加在视频上）
- [x] PC端视频上方加导航栏（← 返回 + 上一期/下一期胶囊按钮）
- [x] 手机端顶部完全去掉，视频全宽显示，上一期/下一期用纯箭头圆形按钮

### 第二阶段
- [x] 任务4+5：手机端主Tab精简为4个（双语/精读/听写/精听），其余收入「更多」按钮
- [x] 任务6：控制条从播放器画面内部移出

### 第三阶段
- [x] 任务7+8：精听功能 + A/B点片段循环
- [x] 任务9：字幕字体大小调节（设置面板滑块，存localStorage）
- [x] 任务10：暗色主题（系统/暗/亮三种，存localStorage）

### 第四阶段：追加功能
- [x] PC端和手机端50/50布局（播放器/字幕区各占一半）
- [x] 字体优化：Inter var字体 + antialiased + font-synthesis:none + letter-spacing:0.025em + font-weight:500
- [x] PC端导航栏「首页」按钮（左侧，跳转到 /）
- [x] PC端隐藏字幕按钮（字幕导航栏，词卡后面）
- [x] PC端跟读区域（播放器控制条下方，始终显示，含收藏/本子/笔记/录音/切换听写）
- [x] 手机端跟读Tab（双语/跟读/听写/词卡，功能与PC端一致）
- [x] 深色模式字幕 + 跟读区域颜色适配
- [x] 播放器覆盖按钮显示逻辑（播放中隐藏，暂停/结束时显示）
- [x] 字幕笔记功能（后端API + 前端，存服务器，跨设备同步）
- [x] 字幕录音功能（IndexedDB存储，录音/回放/对比原音/重录/删除）
- [x] 手机端字幕行按钮移到字幕下方（笔记/收藏/本子/录音）
- [x] 手机端首页按钮（播放器左上角🏠 + 上一期< + 下一期>）
- [x] 最近学习记录修复（每次进入视频页都更新 learned_at）
- [x] 词卡详情页彩色分类标签
- [x] 跟读区域笔记 + 录音按钮（PC端和手机端）

## 待完成任务
- [ ] 任务12：字幕PDF下载

---

## 重要注意事项
- 手机端（isMobile）和PC端逻辑分开处理，不要互相影响
- 所有新增的用户偏好设置存入 localStorage
- 录音数据存入 IndexedDB（本地，不跨设备）
- 笔记数据存入服务器（跨设备同步）
- 改完后用 `npm run dev` 在浏览器验证效果（手机端用Chrome DevTools模拟）
