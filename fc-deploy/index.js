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

// ============ 间隔重复算法 ============

/**
 * 根据熟练度计算下次复习间隔（天数）
 * 使用简化版 SM-2 算法
 */
function getIntervalDays(familiarityLevel) {
  const intervals = [1, 3, 7, 14, 30, 60];
  const level = Math.min(familiarityLevel, intervals.length - 1);
  return intervals[level];
}

/**
 * 计算下次复习时间
 * @param {number} familiarityLevel - 当前熟练度
 * @returns {Date} 下次复习时间
 */
function calculateNextReviewAt(familiarityLevel) {
  const intervalDays = getIntervalDays(familiarityLevel);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);
  // 设置为当天的 0 点（方便比较"今日待复习"）
  nextReview.setHours(0, 0, 0, 0);
  return nextReview;
}

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

// 视频列表（支持筛选）
app.get('/api/videos', async (req, res) => {
  try {
    const { category, level, accent, gender, author, sort } = req.query;

    let sql = 'SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent, gender FROM videos WHERE 1=1';
    const params = [];

    if (category && category !== '全部') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (level) {
      params.push(level);
      sql += ` AND level = $${params.length}`;
    }
    if (accent && accent !== '全部') {
      params.push(accent);
      sql += ` AND accent = $${params.length}`;
    }
    if (gender && gender !== '全部') {
      params.push(gender);
      sql += ` AND gender = $${params.length}`;
    }
    if (author) {
      params.push(author);
      sql += ` AND author = $${params.length}`;
    }

    // 排序：默认倒序（新的在前）
    sql += ` ORDER BY episode ${sort === 'asc' ? 'ASC' : 'DESC'}`;

    const result = await pool.query(sql, params);
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

// 获取单个视频详情
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent, gender FROM videos WHERE id = $1',
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

// 获取最近学习的视频
app.get('/api/user/recent-learning', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.video_id, p.learned_at, 
             v.title, v.episode, v.cover
      FROM user_progress p
      JOIN videos v ON p.video_id::text = v.id::text
      WHERE p.user_id = $1 AND p.item_type = 'video'
      ORDER BY p.learned_at DESC
      LIMIT 1
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('获取最近学习失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
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

// 获取用户笔记本列表（带统计信息，包括待复习数量）
app.get('/api/user/notebooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT id, name, color, created_at FROM user_notebooks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // 获取每个笔记本的统计信息（包括待复习数量）
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

      const vocabCount = parseInt(vocabResult.rows[0].count);
      const sentenceCount = parseInt(sentenceResult.rows[0].count);

      // ========== 计算待复习数量 ==========
      // 获取本子里所有词汇的 item_id
      const vocabItemsResult = await pool.query(
        "SELECT item_id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'vocab'",
        [notebook.id]
      );
      const vocabItemIds = vocabItemsResult.rows.map(r => r.item_id);

      // 获取本子里所有句子的 item_id
      const sentenceItemsResult = await pool.query(
        "SELECT item_id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'sentence'",
        [notebook.id]
      );
      const sentenceItemIds = sentenceItemsResult.rows.map(r => r.item_id);

      // 获取这些词汇/句子的复习状态
      let dueVocabCount = 0;
      let dueSentenceCount = 0;
      const now = new Date();
      // 设置为今天的结束时间，这样"今天到期"的都会被包含
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (vocabItemIds.length > 0) {
        // 查询这些词汇的复习状态
        const vocabStatesResult = await pool.query(
          `SELECT item_id, next_review_at FROM user_review_states 
           WHERE user_id = $1 AND item_type = 'vocab' AND item_id = ANY($2)`,
          [userId, vocabItemIds]
        );

        // 构建已有复习状态的词汇映射
        const vocabStatesMap = new Map();
        vocabStatesResult.rows.forEach(r => {
          vocabStatesMap.set(r.item_id, r.next_review_at);
        });

        // 计算待复习数量
        vocabItemIds.forEach(itemId => {
          const nextReviewAt = vocabStatesMap.get(itemId);
          if (!nextReviewAt) {
            // 没有复习状态 = 新词，需要学习
            dueVocabCount++;
          } else {
            const nextReview = new Date(nextReviewAt);
            if (nextReview <= todayEnd) {
              // 到期了，需要复习
              dueVocabCount++;
            }
          }
        });
      }

      if (sentenceItemIds.length > 0) {
        // 查询这些句子的复习状态
        const sentenceStatesResult = await pool.query(
          `SELECT item_id, next_review_at FROM user_review_states 
           WHERE user_id = $1 AND item_type = 'sentence' AND item_id = ANY($2)`,
          [userId, sentenceItemIds]
        );

        // 构建已有复习状态的句子映射
        const sentenceStatesMap = new Map();
        sentenceStatesResult.rows.forEach(r => {
          sentenceStatesMap.set(r.item_id, r.next_review_at);
        });

        // 计算待复习数量
        sentenceItemIds.forEach(itemId => {
          const nextReviewAt = sentenceStatesMap.get(itemId);
          if (!nextReviewAt) {
            // 没有复习状态 = 新句子，需要学习
            dueSentenceCount++;
          } else {
            const nextReview = new Date(nextReviewAt);
            if (nextReview <= todayEnd) {
              // 到期了，需要复习
              dueSentenceCount++;
            }
          }
        });
      }

      return {
        ...notebook,
        item_count: vocabCount + sentenceCount,
        vocab_count: vocabCount,
        sentence_count: sentenceCount,
        due_vocab_count: dueVocabCount,
        due_sentence_count: dueSentenceCount,
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

// 保存/更新复习状态（实现间隔重复算法）
app.post('/api/user/review-states', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      item_type,
      item_id,
      video_id,
      notebook_id,
      last_result_known,  // true = 我会了, false = 还不熟
    } = req.body;

    if (!item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const itemIdStr = String(item_id);
    const isKnown = !!last_result_known;

    // 检查是否已存在复习状态
    const existing = await pool.query(
      'SELECT id, review_count, familiarity_level, success_streak FROM user_review_states WHERE user_id = $1 AND item_type = $2 AND item_id = $3',
      [userId, item_type, itemIdStr]
    );

    let result;
    if (existing.rows.length > 0) {
      // ========== 更新已有记录 ==========
      const current = existing.rows[0];
      const oldLevel = current.familiarity_level || 0;
      const oldStreak = current.success_streak || 0;
      const oldCount = current.review_count || 0;

      // 根据复习结果计算新的状态
      let newLevel, newStreak;
      if (isKnown) {
        // 答对：熟练度 +1，连续成功 +1
        newLevel = Math.min(oldLevel + 1, 10);  // 最高 10 级
        newStreak = oldStreak + 1;
      } else {
        // 答错：熟练度重置为 0，连续成功重置为 0
        newLevel = 0;
        newStreak = 0;
      }

      // 计算下次复习时间
      const nextReviewAt = calculateNextReviewAt(newLevel);

      console.log('[review-states] Update:', {
        item_id: itemIdStr,
        isKnown,
        oldLevel,
        newLevel,
        nextReviewAt: nextReviewAt.toISOString()
      });

      result = await pool.query(
        `UPDATE user_review_states SET 
          review_count = $1,
          familiarity_level = $2,
          success_streak = $3,
          last_result_known = $4,
          last_review_at = NOW(),
          next_review_at = $5,
          updated_at = NOW()
        WHERE id = $6 RETURNING *`,
        [oldCount + 1, newLevel, newStreak, isKnown, nextReviewAt.toISOString(), current.id]
      );
    } else {
      // ========== 插入新记录（第一次学习）==========
      // 第一次学习，熟练度从 0 开始
      const newLevel = isKnown ? 1 : 0;
      const newStreak = isKnown ? 1 : 0;
      const nextReviewAt = calculateNextReviewAt(newLevel);

      console.log('[review-states] Insert:', {
        item_id: itemIdStr,
        isKnown,
        newLevel,
        nextReviewAt: nextReviewAt.toISOString()
      });

      result = await pool.query(
        `INSERT INTO user_review_states 
          (user_id, item_type, item_id, video_id, notebook_id, review_count, familiarity_level, success_streak, last_result_known, last_review_at, next_review_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10) RETURNING *`,
        [userId, item_type, itemIdStr, video_id || null, notebook_id || null, 1, newLevel, newStreak, isKnown, nextReviewAt.toISOString()]
      );
    }

    // 同时记录复习日志（用于统计）
    try {
      await pool.query(
        'INSERT INTO user_review_logs (user_id, item_type, item_id, is_known) VALUES ($1, $2, $3, $4)',
        [userId, item_type, itemIdStr, isKnown]
      );
    } catch (logError) {
      // 日志记录失败不影响主流程
      console.error('记录复习日志失败:', logError);
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