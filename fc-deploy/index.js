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
    const { phone, password, nickname } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: '手机号和密码不能为空' });
    }

    // 检查手机号是否已存在
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: '手机号已存在' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await pool.query(
      'INSERT INTO users (phone, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id, phone, nickname, created_at',
      [phone, passwordHash, nickname || null]
    );

    const user = result.rows[0];

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, phone: user.phone, nickname: user.nickname },
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
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: '手机号和密码不能为空' });
    }

    // 查找用户
    const result = await pool.query(
      'SELECT id, phone, password_hash, nickname, is_active FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: '手机号或密码错误' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: '手机号或密码错误' });
    }

    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, phone: user.phone, nickname: user.nickname },
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
      'SELECT id, phone, nickname, avatar_url, created_at FROM users WHERE id = $1',
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
    const result = await pool.query('SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent FROM videos ORDER BY episode DESC');
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
      'SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent FROM videos WHERE id = $1',
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

// ============ 用户进度 API ============

// 获取用户进度
app.get('/api/user/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id } = req.query;

    let query = 'SELECT id, video_id, item_type, item_id, learned_at, created_at FROM user_progress WHERE user_id = $1';
    let params = [userId];

    if (video_id) {
      query += ' AND video_id = $2';
      params.push(video_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取进度失败:', error);
    res.status(500).json({ success: false, error: '获取进度失败' });
  }
});

// 保存用户进度
app.post('/api/user/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id, item_type, item_id } = req.body;

    if (!video_id || !item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 检查是否已存在
    const existing = await pool.query(
      'SELECT id FROM user_progress WHERE user_id = $1 AND video_id = $2 AND item_type = $3 AND item_id = $4',
      [userId, video_id, item_type, item_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '进度已存在' });
    }

    const result = await pool.query(
      'INSERT INTO user_progress (user_id, video_id, item_type, item_id, learned_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [userId, video_id, item_type, item_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('保存进度失败:', error);
    res.status(500).json({ success: false, error: '保存进度失败' });
  }
});

// 删除用户进度 - 通过记录 ID
app.delete('/api/user/progress/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const progressId = req.params.id;

    await pool.query(
      'DELETE FROM user_progress WHERE id = $1 AND user_id = $2',
      [progressId, userId]
    );

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除进度失败:', error);
    res.status(500).json({ success: false, error: '删除进度失败' });
  }
});

// ============ 用户收藏 API ============

// 获取用户收藏
app.get('/api/user/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id, item_type } = req.query;

    let query = 'SELECT id, video_id, item_type, item_id, created_at FROM user_favorites WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (video_id) {
      query += ` AND video_id = $${paramIndex}`;
      params.push(video_id);
      paramIndex++;
    }

    if (item_type) {
      query += ` AND item_type = $${paramIndex}`;
      params.push(item_type);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取收藏失败:', error);
    res.status(500).json({ success: false, error: '获取收藏失败' });
  }
});

// 添加收藏
app.post('/api/user/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id, item_type, item_id } = req.body;

    if (!video_id || !item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 检查是否已收藏
    const existing = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND video_id = $2 AND item_type = $3 AND item_id = $4',
      [userId, video_id, item_type, String(item_id)]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '已收藏' });
    }

    const result = await pool.query(
      'INSERT INTO user_favorites (user_id, video_id, item_type, item_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, video_id, item_type, String(item_id)]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.status(500).json({ success: false, error: '添加收藏失败' });
  }
});

// 删除收藏 - 通过记录 ID
app.delete('/api/user/favorites/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const favoriteId = req.params.id;

    await pool.query(
      'DELETE FROM user_favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );

    res.json({ success: true, message: '取消收藏成功' });
  } catch (error) {
    console.error('删除收藏失败:', error);
    res.status(500).json({ success: false, error: '删除收藏失败' });
  }
});

// ============ 笔记本 API ============

// 获取用户笔记本列表（带统计信息）
app.get('/api/user/notebooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT id, name, color, created_at FROM user_notebooks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // 获取每个笔记本的统计信息
    const notebooks = await Promise.all(result.rows.map(async (notebook) => {
      // 获取词汇数量
      const vocabResult = await pool.query(
        "SELECT COUNT(*) as count FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'vocab'",
        [notebook.id]
      );
      // 获取句子数量
      const sentenceResult = await pool.query(
        "SELECT COUNT(*) as count FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'sentence'",
        [notebook.id]
      );

      return {
        ...notebook,
        item_count: parseInt(vocabResult.rows[0].count) + parseInt(sentenceResult.rows[0].count),
        vocab_count: parseInt(vocabResult.rows[0].count),
        sentence_count: parseInt(sentenceResult.rows[0].count)
      };
    }));

    res.json({ success: true, data: notebooks });
  } catch (error) {
    console.error('获取笔记本失败:', error);
    res.status(500).json({ success: false, error: '获取笔记本失败' });
  }
});

// 创建笔记本
app.post('/api/user/notebooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '笔记本名称不能为空' });
    }

    const result = await pool.query(
      'INSERT INTO user_notebooks (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, color || '#3B82F6']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('创建笔记本失败:', error);
    res.status(500).json({ success: false, error: '创建笔记本失败' });
  }
});

// 更新笔记本（重命名）
app.put('/api/user/notebooks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '笔记本名称不能为空' });
    }

    // 检查笔记本是否属于该用户
    const existing = await pool.query(
      'SELECT id FROM user_notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: '笔记本不存在' });
    }

    const result = await pool.query(
      'UPDATE user_notebooks SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name, notebookId, userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('更新笔记本失败:', error);
    res.status(500).json({ success: false, error: '更新笔记本失败' });
  }
});

// 删除笔记本
app.delete('/api/user/notebooks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;

    // 先删除笔记本中的所有内容
    await pool.query('DELETE FROM user_notebook_items WHERE notebook_id = $1 AND user_id = $2', [notebookId, userId]);

    // 删除笔记本
    await pool.query('DELETE FROM user_notebooks WHERE id = $1 AND user_id = $2', [notebookId, userId]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除笔记本失败:', error);
    res.status(500).json({ success: false, error: '删除笔记本失败' });
  }
});

// 获取笔记本内容
app.get('/api/user/notebooks/:id/items', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;

    const result = await pool.query(
      'SELECT id, item_type, item_id, video_id, created_at FROM user_notebook_items WHERE notebook_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [notebookId, userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取笔记本内容失败:', error);
    res.status(500).json({ success: false, error: '获取笔记本内容失败' });
  }
});

// 添加内容到笔记本
app.post('/api/user/notebooks/:id/items', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;
    const { item_type, item_id, video_id } = req.body;

    console.log('添加到笔记本请求:', { userId, notebookId, item_type, item_id, video_id });

    if (!item_type || item_id === undefined || !video_id) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 检查笔记本是否属于该用户
    const notebook = await pool.query(
      'SELECT id FROM user_notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, userId]
    );

    if (notebook.rows.length === 0) {
      return res.status(404).json({ success: false, error: '笔记本不存在' });
    }

    // 统一转换为字符串进行比较
    const itemIdStr = String(item_id);

    // 检查是否已添加
    const existing = await pool.query(
      'SELECT id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = $2 AND item_id = $3 AND video_id = $4',
      [notebookId, item_type, itemIdStr, video_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '已添加到笔记本' });
    }

    const result = await pool.query(
      'INSERT INTO user_notebook_items (user_id, notebook_id, item_type, item_id, video_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, notebookId, item_type, itemIdStr, video_id]
    );

    console.log('添加成功:', result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('添加到笔记本失败:', error);
    res.status(500).json({ success: false, error: '添加到笔记本失败: ' + error.message });
  }
});

// 从笔记本删除内容
app.delete('/api/user/notebooks/:id/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id: notebookId, itemId } = req.params;

    await pool.query(
      'DELETE FROM user_notebook_items WHERE id = $1 AND notebook_id = $2 AND user_id = $3',
      [itemId, notebookId, userId]
    );

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('从笔记本删除失败:', error);
    res.status(500).json({ success: false, error: '从笔记本删除失败' });
  }
});

// ============ 复习状态 API ============

// 获取复习状态
app.get('/api/user/review-states', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notebook_id, video_id } = req.query;

    let query = 'SELECT * FROM user_review_states WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (notebook_id) {
      query += ` AND notebook_id = $${paramIndex}`;
      params.push(notebook_id);
      paramIndex++;
    }

    if (video_id) {
      query += ` AND video_id = $${paramIndex}`;
      params.push(video_id);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取复习状态失败:', error);
    res.status(500).json({ success: false, error: '获取复习状态失败' });
  }
});

// 保存/更新复习状态
app.post('/api/user/review-states', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      item_type,
      item_id,
      video_id,
      notebook_id,
      review_count,
      familiarity_level,
      success_streak,
      last_result_known,
      next_review_at
    } = req.body;

    if (!item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 检查是否已存在
    const existing = await pool.query(
      'SELECT id FROM user_review_states WHERE user_id = $1 AND item_type = $2 AND item_id = $3 AND (notebook_id = $4 OR ($4 IS NULL AND notebook_id IS NULL))',
      [userId, item_type, String(item_id), notebook_id || null]
    );

    let result;
    if (existing.rows.length > 0) {
      // 更新
      result = await pool.query(
        `UPDATE user_review_states SET 
          review_count = COALESCE($1, review_count),
          familiarity_level = COALESCE($2, familiarity_level),
          success_streak = COALESCE($3, success_streak),
          last_result_known = COALESCE($4, last_result_known),
          last_review_at = NOW(),
          next_review_at = COALESCE($5, next_review_at),
          updated_at = NOW()
        WHERE id = $6 RETURNING *`,
        [review_count, familiarity_level, success_streak, last_result_known, next_review_at, existing.rows[0].id]
      );
    } else {
      // 插入
      result = await pool.query(
        `INSERT INTO user_review_states 
          (user_id, item_type, item_id, video_id, notebook_id, review_count, familiarity_level, success_streak, last_result_known, last_review_at, next_review_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10) RETURNING *`,
        [userId, item_type, String(item_id), video_id || null, notebook_id || null, review_count || 1, familiarity_level || 0, success_streak || 0, last_result_known, next_review_at || null]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('保存复习状态失败:', error);
    res.status(500).json({ success: false, error: '保存复习状态失败' });
  }
});

// ============ 复习日志 API ============

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