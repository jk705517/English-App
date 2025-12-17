const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 9000;

// 解析 JSON 请求体
app.use(express.json());

// JWT 密钥（生产环境应该放在环境变量里）
const JWT_SECRET = process.env.JWT_SECRET || 'biubiu-english-secret-key-2024';

// 数据库连接
const pool = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  database: process.env.RDS_DB,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: false
});

// CORS 中间件
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// JWT 验证中间件
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// ============ 认证相关 API ============

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    // 检查邮箱是否已存在
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id, email, nickname, created_at',
      [email, passwordHash, nickname || null]
    );

    const user = result.rows[0];

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, nickname: user.nickname },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    // 查找用户
    const result = await pool.query(
      'SELECT id, email, password_hash, nickname, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, nickname: user.nickname },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ 视频相关 API ============

// 视频列表
app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, episode, title, transcript, vocab, cover, video_url FROM videos ORDER BY episode DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 单个视频详情
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid video ID' });
    }

    const result = await pool.query(
      'SELECT id, episode, title, transcript, vocab, cover, video_url FROM videos WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取复习日志统计
app.get('/api/user/review-logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 7;

    // 计算起始日期
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `SELECT item_type, created_at 
       FROM user_review_logs 
       WHERE user_id = $1 AND created_at >= $2 
       ORDER BY created_at DESC`,
      [userId, startDate.toISOString()]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取复习日志失败:', error);
    res.status(500).json({ success: false, error: '获取复习日志失败' });
  }
});

// 健康检查
app.get('/', (req, res) => {
  res.send('BiuBiu API is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});