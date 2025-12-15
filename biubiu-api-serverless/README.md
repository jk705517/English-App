# BiuBiu English - Serverless API

独立的 Serverless API 项目，连接阿里云 RDS PostgreSQL，为 BiuBiu English 前端提供数据接口。

## 📂 项目结构

```
biubiu-api-serverless/
├── api/
│   ├── videos.js          # GET /api/videos - 获取视频列表
│   └── videos/
│       └── [id].js        # GET /api/videos/:id - 获取单个视频详情
├── package.json
├── vercel.json
├── .env.example           # 环境变量模板
└── README.md
```

## 🚀 部署到 Vercel

### 1. 推送代码到 GitHub

```bash
# 在 English-App 仓库中创建 api-serverless 文件夹
# 把本项目所有文件放入该文件夹
git add api-serverless/
git commit -m "feat: 添加独立 Serverless API 项目"
git push
```

### 2. 在 Vercel 创建新项目

1. 访问 https://vercel.com/new
2. 选择 `English-App` 仓库
3. **重要**：在 "Root Directory" 中填写 `api-serverless`
4. 点击 "Deploy"

### 3. 配置环境变量

在 Vercel 项目的 Settings → Environment Variables 中添加：

| 变量名 | 值 |
|--------|-----|
| `RDS_HOST` | `pgm-bp1y97ql5cq868e0po.pg.rds.aliyuncs.com` |
| `RDS_PORT` | `5432` |
| `RDS_DB` | `biubiu_english` |
| `RDS_USER` | `app_user` |
| `RDS_PASSWORD` | `Jkstyle705517` |

### 4. 重新部署

配置环境变量后，点击 "Redeploy" 使配置生效。

## ✅ 验证 API

部署成功后，访问以下地址验证：

### 获取视频列表
```
GET https://your-api-project.vercel.app/api/videos
```

**预期响应**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "episode": 1,
      "title": "视频标题",
      "transcript": [...],
      "vocab": {...}
    }
  ],
  "count": 10,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 获取单个视频
```
GET https://your-api-project.vercel.app/api/videos/1
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "episode": 1,
    "title": "视频标题",
    "transcript": [...],
    "vocab": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 本地开发（可选）

```bash
# 安装依赖
npm install

# 创建 .env.local（从 .env.example 复制）
cp .env.example .env.local

# 启动 Vercel 本地开发服务器
npm run dev
```

访问 http://localhost:3000/api/videos 测试。

## 📝 下一步

API 验证成功后，修改前端项目的数据请求地址：

```javascript
// 原来：从 Supabase 读取
const { data } = await supabase.from('videos').select('*');

// 改为：从新 API 读取
const response = await fetch('https://your-api-project.vercel.app/api/videos');
const { data } = await response.json();
```

## 🔒 安全说明

- 密码已配置在 Vercel 环境变量中，不会暴露在代码里
- `.gitignore` 已忽略 `.env` 文件
- API 已配置 CORS 允许前端跨域调用
- 使用连接池优化数据库连接性能

## ⚠️ 重要提醒

- 这个项目**独立部署**，与前端 Vite 项目分开
- 不要在前端项目里放 `/api` 文件夹（会被 Service Worker 吞掉）
- RDS 白名单需包含 Vercel 的出口 IP
