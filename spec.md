# 项目：TEco Lab 风格英语学习网站 (MVP)

## 1. 全局技术栈 (Tech Stack)
- **构建工具**: Vite (React 模板)
- **前端框架**: React 18+
- **样式库**: Tailwind CSS (用于快速构建 Grid/Flex 布局)
- **路由管理**: React Router DOM
- **图标库**: Lucide React
- **数据存储**: 浏览器 LocalStorage (MVP阶段不涉及后端数据库)
- **语言**: JavaScript (为了快速原型开发，暂不用 TS)

## 2. 页面功能规划 (Page Specs)

### 2.1 首页 / 仪表盘 (Home Dashboard)
- **布局**: 左侧固定侧边栏 + 右侧响应式网格布局。
- **核心组件**:
    - **统计卡片**: 显示“总期数”、“已学习”、“未学习”。
    - **视频卡片 (VideoCard)**: 必须包含封面、标题、时长、作者、难度星级、学习状态标签（已学/未学）。
    - **筛选器**: 简单的标签筛选功能（如：生活、科技、职场）。

### 2.2 视频详情页 (Video Player & Study)
- **核心交互**:
    - **左侧**: 视频播放器 (使用 `react-player` 或 iframe)。
    - **右侧**: 智能字幕栏 (Transcript)。支持点击字幕跳转视频进度；当前播放句高亮显示。
    - **下方**: 重点词汇卡片 (Vocab Cards)，展示单词、词性颜色标记、例句。
- **状态**: 需要实时记录播放进度。

### 2.3 设置页 (Settings)
- **偏好设置**:
    - 字幕模式: 双语 / 仅英文 / 仅中文 / 听写模式(隐藏字幕)。
    - 自动循环: 单句播放结束后是自动暂停还是继续。
- **数据**: 设置项保存在 LocalStorage 中，全局生效。

## 3. 数据模型模拟 (Mock Data Schema)
在 `src/data/mockData.js` 中建立模拟数据，结构如下：
```json
{
  "id": 1,
  "title": "Why learn English?",
  "videoUrl": "YouTube_Link_Here",
  "duration": "12:26",
  "transcript": [
    { "start": 0, "text": "Hello", "cn": "你好" }
  ],
  "vocab": [
    { "word": "Ambition", "meaning": "野心", "type": "noun" }
  ]
}
## 4. 目录结构建议
- /src/components (通用组件)
- /src/pages (页面组件)
- /src/context (全局状态)
- /src/data (模拟数据)