const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const port = 9000;

// 解析 JSON 请求体
app.use(express.json());

// JWT 密钥（生产环境应该放在环境变量里）
const JWT_SECRET = process.env.JWT_SECRET || 'biubiu-english-secret-key-2024';

// ============ Azure TTS 配置 ============
const AZURE_TTS_KEY = process.env.AZURE_TTS_KEY || '';
const AZURE_TTS_REGION = process.env.AZURE_TTS_REGION || 'eastasia';

// 语音配置：美音和英音
const VOICE_MAP = {
  'us': 'en-US-JennyNeural',    // 美音女声
  'uk': 'en-GB-SoniaNeural'     // 英音女声
};

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

// ============ 设备管理辅助函数 ============

/**
 * 管理设备登录
 * - 同一设备更新登录时间
 * - 新设备检查数量限制（最多3台）
 * - 超过限制踢掉最早的设备
 */
async function manageDeviceLogin(userId, deviceId, deviceName) {
  try {
    // 检查设备是否已存在
    const existing = await pool.query(
      'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    if (existing.rows.length > 0) {
      // 设备已存在，更新最后登录时间
      await pool.query(
        'UPDATE user_devices SET last_login_at = NOW(), device_name = $1 WHERE user_id = $2 AND device_id = $3',
        [deviceName, userId, deviceId]
      );
    } else {
      // 新设备，检查数量限制
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_devices WHERE user_id = $1',
        [userId]
      );
      const deviceCount = parseInt(countResult.rows[0].count);

      // 如果已有3台设备，踢掉最早的
      if (deviceCount >= 3) {
        await pool.query(
          `DELETE FROM user_devices WHERE id IN (
            SELECT id FROM user_devices WHERE user_id = $1 
            ORDER BY last_login_at ASC LIMIT $2
          )`,
          [userId, deviceCount - 2]  // 保留2台，给新设备腾位置
        );
      }

      // 添加新设备
      await pool.query(
        'INSERT INTO user_devices (user_id, device_id, device_name) VALUES ($1, $2, $3)',
        [userId, deviceId, deviceName]
      );
    }
  } catch (error) {
    console.error('设备管理失败:', error);
    // 不阻断登录流程
  }
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
        user: { id: user.id, phone: user.phone, nickname: user.nickname, email: user.email },
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
    const { phone, password, deviceId, deviceName } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: '手机号和密码不能为空' });
    }

    // 查找用户
    const result = await pool.query(
      'SELECT id, phone, password_hash, nickname, is_active, email FROM users WHERE phone = $1',
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

    // 设备管理：记录登录设备
    const finalDeviceId = deviceId || 'unknown-' + Date.now();
    const finalDeviceName = deviceName || 'Unknown Device';
    await manageDeviceLogin(user.id, finalDeviceId, finalDeviceName);

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, phone: user.phone, nickname: user.nickname, email: user.email },
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
      'SELECT id, phone, nickname, avatar, avatar_url, created_at, email FROM users WHERE id = $1',
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

// ============ 注册链接相关 API ============

// 1. 生成注册链接（管理员用）
app.post('/api/admin/generate-link', async (req, res) => {
  try {
    const { phone, adminPassword } = req.body;

    // 验证管理员密码
    const correctPassword = process.env.ADMIN_PASSWORD || 'biubiu2025admin';
    if (adminPassword !== correctPassword) {
      return res.status(403).json({ success: false, error: '管理员密码错误' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: '手机号不能为空' });
    }

    // 检查手机号是否已注册
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: '该手机号已注册' });
    }

    // 生成 token
    const token = crypto.randomUUID();

    // 生成密码：biubiu + 手机号后4位
    const password = 'biubiu' + phone.slice(-4);

    // 计算过期时间：24小时后
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 存入数据库
    await pool.query(
      'INSERT INTO registration_links (token, phone, password, expires_at) VALUES ($1, $2, $3, $4)',
      [token, phone, password, expiresAt]
    );

    res.json({
      success: true,
      link: `https://biubiuenglish.com/activate/${token}`,
      phone,
      password
    });
  } catch (error) {
    console.error('生成注册链接失败:', error);
    res.status(500).json({ success: false, message: '生成链接失败' });
  }
});

// 2. 获取链接信息
app.get('/api/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // 查询链接信息
    const result = await pool.query(
      'SELECT phone, password, expires_at, is_used FROM registration_links WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '链接无效' });
    }

    const link = result.rows[0];

    // 检查是否已使用
    if (link.is_used) {
      return res.status(400).json({ success: false, message: '链接已被使用' });
    }

    // 检查是否过期
    if (new Date() > new Date(link.expires_at)) {
      return res.status(400).json({ success: false, message: '链接已过期' });
    }

    res.json({
      success: true,
      phone: link.phone,
      password: link.password,
      expired: false,
      used: false
    });
  } catch (error) {
    console.error('获取链接信息失败:', error);
    res.status(500).json({ success: false, message: '获取链接信息失败' });
  }
});

// 3. 激活账号
app.post('/api/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // 查询链接信息
    const linkResult = await pool.query(
      'SELECT id, phone, password, expires_at, is_used FROM registration_links WHERE token = $1',
      [token]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '链接无效' });
    }

    const link = linkResult.rows[0];

    // 检查是否已使用
    if (link.is_used) {
      return res.status(400).json({ success: false, message: '链接已被使用' });
    }

    // 检查是否过期
    if (new Date() > new Date(link.expires_at)) {
      return res.status(400).json({ success: false, message: '链接已过期' });
    }

    // 检查手机号是否已注册
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [link.phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: '该手机号已注册' });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(link.password, 10);

    // 创建用户
    await pool.query(
      'INSERT INTO users (phone, password_hash) VALUES ($1, $2)',
      [link.phone, passwordHash]
    );

    // 标记链接为已使用
    await pool.query(
      'UPDATE registration_links SET is_used = true WHERE id = $1',
      [link.id]
    );

    res.json({
      success: true,
      message: '账号激活成功',
      phone: link.phone
    });
  } catch (error) {
    console.error('激活账号失败:', error);
    res.status(500).json({ success: false, message: '激活账号失败' });
  }
});

// 4. 绑定邮箱
app.put('/api/user/email', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: '邮箱不能为空' });
    }

    // 更新邮箱
    await pool.query(
      'UPDATE users SET email = $1 WHERE id = $2',
      [email, userId]
    );

    res.json({ success: true, message: '邮箱绑定成功' });
  } catch (error) {
    console.error('绑定邮箱失败:', error);
    res.status(500).json({ success: false, message: '绑定邮箱失败' });
  }
});

// 5. 验证手机号+邮箱（忘记密码第一步）
app.post('/api/auth/verify-reset', async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!phone || !email) {
      return res.status(400).json({ success: false, message: '手机号和邮箱不能为空' });
    }

    // 查询用户
    const result = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND email = $2',
      [phone, email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: '手机号或邮箱不正确' });
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('验证失败:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

// 6. 重置密码（忘记密码第二步）
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, email, newPassword } = req.body;

    if (!phone || !email || !newPassword) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 再次验证手机号和邮箱
    const result = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND email = $2',
      [phone, email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: '手机号或邮箱不正确' });
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ success: false, message: '重置密码失败' });
  }
});

// ============ 用户设置 API ============

// 修改用户资料（昵称、头像）
app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nickname, avatar } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(nickname);
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${paramIndex++}`);
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, phone, nickname, avatar`;
    const result = await pool.query(sql, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// 提交意见反馈
app.post('/api/user/feedback', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, content } = req.body;

    if (!type || !content) {
      return res.status(400).json({ success: false, error: '请填写反馈类型和内容' });
    }

    const result = await pool.query(
      'INSERT INTO user_feedback (user_id, type, content) VALUES ($1, $2, $3) RETURNING id',
      [userId, type, content]
    );

    res.json({ success: true, data: { id: result.rows[0].id }, message: '感谢您的反馈！' });
  } catch (error) {
    console.error('提交反馈失败:', error);
    res.status(500).json({ success: false, error: '提交失败' });
  }
});

// 获取设备列表
app.get('/api/user/devices', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      'SELECT id, device_id, device_name, last_login_at, created_at FROM user_devices WHERE user_id = $1 ORDER BY last_login_at DESC',
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 删除指定设备（退出登录）
app.delete('/api/user/devices/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;

    await pool.query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    res.json({ success: true, message: '设备已移除' });
  } catch (error) {
    console.error('删除设备失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// ============ 视频相关 API ============

// 视频列表（支持筛选）
app.get('/api/videos', async (req, res) => {
  try {
    const { category, level, accent, gender, author, sort } = req.query;

    let sql = 'SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent, gender, youtube_url FROM videos WHERE 1=1';
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

// 获取词汇在其他视频中的出现记录
app.get('/api/vocab/occurrences', async (req, res) => {
  try {
    const { word, exclude_video_id } = req.query;

    if (!word) {
      return res.status(400).json({ success: false, message: '缺少 word 参数' });
    }

    // 查询词汇出现记录（排除当前视频）
    let query = `
          SELECT video_id, video_title, episode, vocab_index, example_sentence
          FROM vocab_occurrences
          WHERE word = $1
      `;
    const params = [word.toLowerCase()];

    if (exclude_video_id) {
      query += ` AND video_id != $2`;
      params.push(exclude_video_id);
    }

    query += ` ORDER BY episode ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      word: word,
      total: result.rows.length,
      occurrences: result.rows
    });

  } catch (error) {
    console.error('获取词汇出现记录失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});


// 按期数获取视频详情
app.get('/api/videos/episode/:episode', async (req, res) => {
  try {
    const { episode } = req.params;

    const videoResult = await pool.query(
      `SELECT id, title, video_url, cover, category, author, level, duration, 
              accent, gender, episode, transcript, vocab, has_deep_reading, 
              audio_url, youtube_url, podcast_url
       FROM videos WHERE episode = $1`,
      [episode]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }

    const video = videoResult.rows[0];
    const currentEpisode = video.episode;

    const prevResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode < $1 
       ORDER BY episode DESC LIMIT 1`,
      [currentEpisode]
    );

    const nextResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode > $1 
       ORDER BY episode ASC LIMIT 1`,
      [currentEpisode]
    );

    res.json({
      success: true,
      data: {
        ...video,
        prevVideo: prevResult.rows[0] || null,
        nextVideo: nextResult.rows[0] || null
      }
    });
  } catch (error) {
    console.error('获取视频详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取单个视频详情
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, episode, title, transcript, vocab, cover, video_url, audio_url, category, author, level, duration, accent, gender, youtube_url, podcast_url FROM videos WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    const video = result.rows[0];
    const currentEpisode = video.episode;

    // 查询上一期（episode 比当前小的最大值）
    const prevResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode < $1 
       ORDER BY episode DESC LIMIT 1`,
      [currentEpisode]
    );

    // 查询下一期（episode 比当前大的最小值）
    const nextResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode > $1 
       ORDER BY episode ASC LIMIT 1`,
      [currentEpisode]
    );

    res.json({
      success: true,
      data: {
        ...video,
        prevVideo: prevResult.rows[0] || null,
        nextVideo: nextResult.rows[0] || null
      }
    });
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

// ============ Azure TTS API ============

// GET /api/tts - 文本转语音（不需要登录）
app.get('/api/tts', async (req, res) => {
  try {
    const { text, accent = 'us' } = req.query;

    if (!text) {
      return res.status(400).json({ success: false, message: '缺少 text 参数' });
    }

    // 选择语音
    const voice = VOICE_MAP[accent] || VOICE_MAP['us'];

    // 构建 SSML
    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
        <voice name='${voice}'>
          ${text}
        </voice>
      </speak>
    `;

    // 调用 Azure TTS API
    const response = await fetch(
      `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_TTS_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'BiuBiuEnglish'
        },
        body: ssml
      }
    );

    if (!response.ok) {
      console.error('Azure TTS error:', response.status, await response.text());
      return res.status(500).json({ success: false, message: 'TTS 服务错误' });
    }

    // 返回音频流
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400' // 缓存 1 天
    });

    const audioBuffer = await response.arrayBuffer();
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 健康检查
app.get('/', (req, res) => {
  res.send('BiuBiu API is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});