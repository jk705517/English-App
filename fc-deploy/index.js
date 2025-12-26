const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const port = 9000;

// 瑙ｆ瀽 JSON 璇锋眰浣?
app.use(express.json());

// JWT 瀵嗛挜锛堢敓浜х幆澧冨簲璇ユ斁鍦ㄧ幆澧冨彉閲忛噷锛?
const JWT_SECRET = process.env.JWT_SECRET || 'biubiu-english-secret-key-2024';

// ============ Azure TTS 閰嶇疆 ============
const AZURE_TTS_KEY = process.env.AZURE_TTS_KEY || '';
const AZURE_TTS_REGION = process.env.AZURE_TTS_REGION || 'eastasia';

// 璇煶閰嶇疆锛氱編闊冲拰鑻遍煶
const VOICE_MAP = {
  'us': 'en-US-JennyNeural',    // 缇庨煶濂冲０
  'uk': 'en-GB-SoniaNeural'     // 鑻遍煶濂冲０
};

// 鏁版嵁搴撹繛鎺?
const pool = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  database: process.env.RDS_DB,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: false
});

// CORS 涓棿浠?
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// JWT 楠岃瘉涓棿浠?
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

// ============ 闂撮殧閲嶅绠楁硶 ============

/**
 * 鏍规嵁鐔熺粌搴﹁绠椾笅娆″涔犻棿闅旓紙澶╂暟锛?
 * 浣跨敤绠€鍖栫増 SM-2 绠楁硶
 */
function getIntervalDays(familiarityLevel) {
  const intervals = [1, 3, 7, 14, 30, 60];
  const level = Math.min(familiarityLevel, intervals.length - 1);
  return intervals[level];
}

/**
 * 璁＄畻涓嬫澶嶄範鏃堕棿
 * @param {number} familiarityLevel - 褰撳墠鐔熺粌搴?
 * @returns {Date} 涓嬫澶嶄範鏃堕棿
 */
function calculateNextReviewAt(familiarityLevel) {
  const intervalDays = getIntervalDays(familiarityLevel);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);
  // 璁剧疆涓哄綋澶╃殑 0 鐐癸紙鏂逛究姣旇緝"浠婃棩寰呭涔?锛?
  nextReview.setHours(0, 0, 0, 0);
  return nextReview;
}

// ============ 璁惧绠＄悊杈呭姪鍑芥暟 ============

/**
 * 绠＄悊璁惧鐧诲綍
 * - 鍚屼竴璁惧鏇存柊鐧诲綍鏃堕棿
 * - 鏂拌澶囨鏌ユ暟閲忛檺鍒讹紙鏈€澶?鍙帮級
 * - 瓒呰繃闄愬埗韪㈡帀鏈€鏃╃殑璁惧
 */
async function manageDeviceLogin(userId, deviceId, deviceName) {
  try {
    // 妫€鏌ヨ澶囨槸鍚﹀凡瀛樺湪
    const existing = await pool.query(
      'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    if (existing.rows.length > 0) {
      // 璁惧宸插瓨鍦紝鏇存柊鏈€鍚庣櫥褰曟椂闂?
      await pool.query(
        'UPDATE user_devices SET last_login_at = NOW(), device_name = $1 WHERE user_id = $2 AND device_id = $3',
        [deviceName, userId, deviceId]
      );
    } else {
      // 鏂拌澶囷紝妫€鏌ユ暟閲忛檺鍒?
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_devices WHERE user_id = $1',
        [userId]
      );
      const deviceCount = parseInt(countResult.rows[0].count);

      // 濡傛灉宸叉湁3鍙拌澶囷紝韪㈡帀鏈€鏃╃殑
      if (deviceCount >= 3) {
        await pool.query(
          `DELETE FROM user_devices WHERE id IN (
            SELECT id FROM user_devices WHERE user_id = $1 
            ORDER BY last_login_at ASC LIMIT $2
          )`,
          [userId, deviceCount - 2]  // 淇濈暀2鍙帮紝缁欐柊璁惧鑵句綅缃?
        );
      }

      // 娣诲姞鏂拌澶?
      await pool.query(
        'INSERT INTO user_devices (user_id, device_id, device_name) VALUES ($1, $2, $3)',
        [userId, deviceId, deviceName]
      );
    }
  } catch (error) {
    console.error('璁惧绠＄悊澶辫触:', error);
    // 涓嶉樆鏂櫥褰曟祦绋?
  }
}

// ============ 璁よ瘉鐩稿叧 API ============

// 娉ㄥ唽
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phone, password, nickname } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: '鎵嬫満鍙峰拰瀵嗙爜涓嶈兘涓虹┖' });
    }

    // 妫€鏌ユ墜鏈哄彿鏄惁宸插瓨鍦?
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: '鎵嬫満鍙峰凡瀛樺湪' });
    }

    // 鍔犲瘑瀵嗙爜
    const passwordHash = await bcrypt.hash(password, 10);

    // 鍒涘缓鐢ㄦ埛
    const result = await pool.query(
      'INSERT INTO users (phone, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id, phone, nickname, created_at',
      [phone, passwordHash, nickname || null]
    );

    const user = result.rows[0];

    // 鐢熸垚 JWT
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

// 鐧诲綍
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password, deviceId, deviceName } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: '鎵嬫満鍙峰拰瀵嗙爜涓嶈兘涓虹┖' });
    }

    // 鏌ユ壘鐢ㄦ埛
    const result = await pool.query(
      'SELECT id, phone, password_hash, nickname, is_active, email FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: '鎵嬫満鍙锋垨瀵嗙爜閿欒' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    // 楠岃瘉瀵嗙爜
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: '鎵嬫満鍙锋垨瀵嗙爜閿欒' });
    }

    // 鏇存柊鏈€鍚庣櫥褰曟椂闂?
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // 璁惧绠＄悊锛氳褰曠櫥褰曡澶?
    const finalDeviceId = deviceId || 'unknown-' + Date.now();
    const finalDeviceName = deviceName || 'Unknown Device';
    await manageDeviceLogin(user.id, finalDeviceId, finalDeviceName);

    // 鐢熸垚 JWT
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

// 鑾峰彇褰撳墠鐢ㄦ埛淇℃伅
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

// ============ 娉ㄥ唽閾炬帴鐩稿叧 API ============

// 1. 鐢熸垚娉ㄥ唽閾炬帴锛堢鐞嗗憳鐢級
app.post('/api/admin/generate-link', async (req, res) => {
  try {
    const { phone, adminPassword } = req.body;

    // 楠岃瘉绠＄悊鍛樺瘑鐮?
    const correctPassword = process.env.ADMIN_PASSWORD || 'biubiu2025admin';
    if (adminPassword !== correctPassword) {
      return res.status(403).json({ success: false, error: '绠＄悊鍛樺瘑鐮侀敊璇? });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: '鎵嬫満鍙蜂笉鑳戒负绌? });
    }

    // 妫€鏌ユ墜鏈哄彿鏄惁宸叉敞鍐?
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: '璇ユ墜鏈哄彿宸叉敞鍐? });
    }

    // 鐢熸垚 token
    const token = crypto.randomUUID();

    // 鐢熸垚瀵嗙爜锛歜iubiu + 鎵嬫満鍙峰悗4浣?
    const password = 'biubiu' + phone.slice(-4);

    // 璁＄畻杩囨湡鏃堕棿锛?4灏忔椂鍚?
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 瀛樺叆鏁版嵁搴?
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
    console.error('鐢熸垚娉ㄥ唽閾炬帴澶辫触:', error);
    res.status(500).json({ success: false, message: '鐢熸垚閾炬帴澶辫触' });
  }
});

// 2. 鑾峰彇閾炬帴淇℃伅
app.get('/api/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // 鏌ヨ閾炬帴淇℃伅
    const result = await pool.query(
      'SELECT phone, password, expires_at, is_used FROM registration_links WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '閾炬帴鏃犳晥' });
    }

    const link = result.rows[0];

    // 妫€鏌ユ槸鍚﹀凡浣跨敤
    if (link.is_used) {
      return res.status(400).json({ success: false, message: '閾炬帴宸茶浣跨敤' });
    }

    // 妫€鏌ユ槸鍚﹁繃鏈?
    if (new Date() > new Date(link.expires_at)) {
      return res.status(400).json({ success: false, message: '閾炬帴宸茶繃鏈? });
    }

    res.json({
      success: true,
      phone: link.phone,
      password: link.password,
      expired: false,
      used: false
    });
  } catch (error) {
    console.error('鑾峰彇閾炬帴淇℃伅澶辫触:', error);
    res.status(500).json({ success: false, message: '鑾峰彇閾炬帴淇℃伅澶辫触' });
  }
});

// 3. 婵€娲昏处鍙?
app.post('/api/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // 鏌ヨ閾炬帴淇℃伅
    const linkResult = await pool.query(
      'SELECT id, phone, password, expires_at, is_used FROM registration_links WHERE token = $1',
      [token]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '閾炬帴鏃犳晥' });
    }

    const link = linkResult.rows[0];

    // 妫€鏌ユ槸鍚﹀凡浣跨敤
    if (link.is_used) {
      return res.status(400).json({ success: false, message: '閾炬帴宸茶浣跨敤' });
    }

    // 妫€鏌ユ槸鍚﹁繃鏈?
    if (new Date() > new Date(link.expires_at)) {
      return res.status(400).json({ success: false, message: '閾炬帴宸茶繃鏈? });
    }

    // 妫€鏌ユ墜鏈哄彿鏄惁宸叉敞鍐?
    const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [link.phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: '璇ユ墜鏈哄彿宸叉敞鍐? });
    }

    // 鍔犲瘑瀵嗙爜
    const passwordHash = await bcrypt.hash(link.password, 10);

    // 鍒涘缓鐢ㄦ埛
    await pool.query(
      'INSERT INTO users (phone, password_hash) VALUES ($1, $2)',
      [link.phone, passwordHash]
    );

    // 鏍囪閾炬帴涓哄凡浣跨敤
    await pool.query(
      'UPDATE registration_links SET is_used = true WHERE id = $1',
      [link.id]
    );

    res.json({
      success: true,
      message: '璐﹀彿婵€娲绘垚鍔?,
      phone: link.phone
    });
  } catch (error) {
    console.error('婵€娲昏处鍙峰け璐?', error);
    res.status(500).json({ success: false, message: '婵€娲昏处鍙峰け璐? });
  }
});

// 4. 缁戝畾閭
app.put('/api/user/email', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: '閭涓嶈兘涓虹┖' });
    }

    // 鏇存柊閭
    await pool.query(
      'UPDATE users SET email = $1 WHERE id = $2',
      [email, userId]
    );

    res.json({ success: true, message: '閭缁戝畾鎴愬姛' });
  } catch (error) {
    console.error('缁戝畾閭澶辫触:', error);
    res.status(500).json({ success: false, message: '缁戝畾閭澶辫触' });
  }
});

// 5. 楠岃瘉鎵嬫満鍙?閭锛堝繕璁板瘑鐮佺涓€姝ワ級
app.post('/api/auth/verify-reset', async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!phone || !email) {
      return res.status(400).json({ success: false, message: '鎵嬫満鍙峰拰閭涓嶈兘涓虹┖' });
    }

    // 鏌ヨ鐢ㄦ埛
    const result = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND email = $2',
      [phone, email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: '鎵嬫満鍙锋垨閭涓嶆纭? });
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('楠岃瘉澶辫触:', error);
    res.status(500).json({ success: false, message: '楠岃瘉澶辫触' });
  }
});

// 6. 閲嶇疆瀵嗙爜锛堝繕璁板瘑鐮佺浜屾锛?
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, email, newPassword } = req.body;

    if (!phone || !email || !newPassword) {
      return res.status(400).json({ success: false, message: '缂哄皯蹇呰鍙傛暟' });
    }

    // 鍐嶆楠岃瘉鎵嬫満鍙峰拰閭
    const result = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND email = $2',
      [phone, email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: '鎵嬫満鍙锋垨閭涓嶆纭? });
    }

    // 鍔犲瘑鏂板瘑鐮?
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 鏇存柊瀵嗙爜
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: '瀵嗙爜閲嶇疆鎴愬姛' });
  } catch (error) {
    console.error('閲嶇疆瀵嗙爜澶辫触:', error);
    res.status(500).json({ success: false, message: '閲嶇疆瀵嗙爜澶辫触' });
  }
});

// ============ 鐢ㄦ埛璁剧疆 API ============

// 淇敼鐢ㄦ埛璧勬枡锛堟樀绉般€佸ご鍍忥級
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
      return res.status(400).json({ success: false, error: '娌℃湁瑕佹洿鏂扮殑瀛楁' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, phone, nickname, avatar`;
    const result = await pool.query(sql, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('鏇存柊鐢ㄦ埛璧勬枡澶辫触:', error);
    res.status(500).json({ success: false, error: '鏇存柊澶辫触' });
  }
});

// 鎻愪氦鎰忚鍙嶉
app.post('/api/user/feedback', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, content } = req.body;

    if (!type || !content) {
      return res.status(400).json({ success: false, error: '璇峰～鍐欏弽棣堢被鍨嬪拰鍐呭' });
    }

    const result = await pool.query(
      'INSERT INTO user_feedback (user_id, type, content) VALUES ($1, $2, $3) RETURNING id',
      [userId, type, content]
    );

    res.json({ success: true, data: { id: result.rows[0].id }, message: '鎰熻阿鎮ㄧ殑鍙嶉锛? });
  } catch (error) {
    console.error('鎻愪氦鍙嶉澶辫触:', error);
    res.status(500).json({ success: false, error: '鎻愪氦澶辫触' });
  }
});

// 鑾峰彇璁惧鍒楄〃
app.get('/api/user/devices', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      'SELECT id, device_id, device_name, last_login_at, created_at FROM user_devices WHERE user_id = $1 ORDER BY last_login_at DESC',
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('鑾峰彇璁惧鍒楄〃澶辫触:', error);
    res.status(500).json({ success: false, error: '鑾峰彇澶辫触' });
  }
});

// 鍒犻櫎鎸囧畾璁惧锛堥€€鍑虹櫥褰曪級
app.delete('/api/user/devices/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;

    await pool.query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    res.json({ success: true, message: '璁惧宸茬Щ闄? });
  } catch (error) {
    console.error('鍒犻櫎璁惧澶辫触:', error);
    res.status(500).json({ success: false, error: '鍒犻櫎澶辫触' });
  }
});

// ============ 瑙嗛鐩稿叧 API ============

// 瑙嗛鍒楄〃锛堟敮鎸佺瓫閫夛級
app.get('/api/videos', async (req, res) => {
  try {
    const { category, level, accent, gender, author, sort } = req.query;

    let sql = 'SELECT id, episode, title, transcript, vocab, cover, video_url, category, author, level, duration, accent, gender, youtube_url FROM videos WHERE 1=1';
    const params = [];

    if (category && category !== '鍏ㄩ儴') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (level) {
      params.push(level);
      sql += ` AND level = $${params.length}`;
    }
    if (accent && accent !== '鍏ㄩ儴') {
      params.push(accent);
      sql += ` AND accent = $${params.length}`;
    }
    if (gender && gender !== '鍏ㄩ儴') {
      params.push(gender);
      sql += ` AND gender = $${params.length}`;
    }
    if (author) {
      params.push(author);
      sql += ` AND author = $${params.length}`;
    }

    // 鎺掑簭锛氶粯璁ゅ€掑簭锛堟柊鐨勫湪鍓嶏級
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

// 鑾峰彇璇嶆眹鍦ㄥ叾浠栬棰戜腑鐨勫嚭鐜拌褰?
app.get('/api/vocab/occurrences', async (req, res) => {
  try {
    const { word, exclude_video_id } = req.query;

    if (!word) {
      return res.status(400).json({ success: false, message: '缂哄皯 word 鍙傛暟' });
    }

    // 鏌ヨ璇嶆眹鍑虹幇璁板綍锛堟帓闄ゅ綋鍓嶈棰戯級
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
    console.error('鑾峰彇璇嶆眹鍑虹幇璁板綍澶辫触:', error);
    res.status(500).json({ success: false, message: '鏈嶅姟鍣ㄩ敊璇? });
  }
});

// 按期数获取视频详情
app.get('/api/videos/episode/:episode', async (req, res) => {
  try {
    const { episode } = req.params;
    
    // 获取当前视频
    const videoResult = await pool.query(
      `SELECT id, title, video_url, cover, category, author, level, duration, 
              accent, gender, episode, transcript, vocab, has_deep_reading, 
              audio_url, youtube_url
       FROM videos WHERE episode = $1`,
      [episode]
    );
    
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }
    
    const video = videoResult.rows[0];
    const currentEpisode = video.episode;
    
    // 获取上一期（episode 比当前小的最大值）
    const prevResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode < $1 
       ORDER BY episode DESC LIMIT 1`,
      [currentEpisode]
    );
    
    // 获取下一期（episode 比当前大的最小值）
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

// 鑾峰彇鍗曚釜瑙嗛璇︽儏
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, episode, title, transcript, vocab, cover, video_url, audio_url, category, author, level, duration, accent, gender, youtube_url FROM videos WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    const video = result.rows[0];
    const currentEpisode = video.episode;

    // 鏌ヨ涓婁竴鏈燂紙episode 姣斿綋鍓嶅皬鐨勬渶澶у€硷級
    const prevResult = await pool.query(
      `SELECT id, episode, title FROM videos 
       WHERE episode < $1 
       ORDER BY episode DESC LIMIT 1`,
      [currentEpisode]
    );

    // 鏌ヨ涓嬩竴鏈燂紙episode 姣斿綋鍓嶅ぇ鐨勬渶灏忓€硷級
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

// ============ 鐢ㄦ埛杩涘害 API ============

// 鑾峰彇鐢ㄦ埛杩涘害
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
    console.error('鑾峰彇杩涘害澶辫触:', error);
    res.status(500).json({ success: false, error: '鑾峰彇杩涘害澶辫触' });
  }
});

// 鑾峰彇鏈€杩戝涔犵殑瑙嗛
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
    console.error('鑾峰彇鏈€杩戝涔犲け璐?', error);
    res.status(500).json({ success: false, message: '鑾峰彇澶辫触' });
  }
});

// 淇濆瓨鐢ㄦ埛杩涘害
app.post('/api/user/progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id, item_type, item_id } = req.body;

    if (!video_id || !item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟' });
    }

    // 妫€鏌ユ槸鍚﹀凡瀛樺湪
    const existing = await pool.query(
      'SELECT id FROM user_progress WHERE user_id = $1 AND video_id = $2 AND item_type = $3 AND item_id = $4',
      [userId, video_id, item_type, item_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '杩涘害宸插瓨鍦? });
    }

    const result = await pool.query(
      'INSERT INTO user_progress (user_id, video_id, item_type, item_id, learned_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [userId, video_id, item_type, item_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('淇濆瓨杩涘害澶辫触:', error);
    res.status(500).json({ success: false, error: '淇濆瓨杩涘害澶辫触' });
  }
});

// 鍒犻櫎鐢ㄦ埛杩涘害 - 閫氳繃璁板綍 ID
app.delete('/api/user/progress/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const progressId = req.params.id;

    await pool.query(
      'DELETE FROM user_progress WHERE id = $1 AND user_id = $2',
      [progressId, userId]
    );

    res.json({ success: true, message: '鍒犻櫎鎴愬姛' });
  } catch (error) {
    console.error('鍒犻櫎杩涘害澶辫触:', error);
    res.status(500).json({ success: false, error: '鍒犻櫎杩涘害澶辫触' });
  }
});

// ============ 鐢ㄦ埛鏀惰棌 API ============

// 鑾峰彇鐢ㄦ埛鏀惰棌
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
    console.error('鑾峰彇鏀惰棌澶辫触:', error);
    res.status(500).json({ success: false, error: '鑾峰彇鏀惰棌澶辫触' });
  }
});

// 娣诲姞鏀惰棌
app.post('/api/user/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { video_id, item_type, item_id } = req.body;

    if (!video_id || !item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟' });
    }

    // 妫€鏌ユ槸鍚﹀凡鏀惰棌
    const existing = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND video_id = $2 AND item_type = $3 AND item_id = $4',
      [userId, video_id, item_type, String(item_id)]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '宸叉敹钘? });
    }

    const result = await pool.query(
      'INSERT INTO user_favorites (user_id, video_id, item_type, item_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, video_id, item_type, String(item_id)]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('娣诲姞鏀惰棌澶辫触:', error);
    res.status(500).json({ success: false, error: '娣诲姞鏀惰棌澶辫触' });
  }
});

// 鍒犻櫎鏀惰棌 - 閫氳繃璁板綍 ID
app.delete('/api/user/favorites/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const favoriteId = req.params.id;

    await pool.query(
      'DELETE FROM user_favorites WHERE id = $1 AND user_id = $2',
      [favoriteId, userId]
    );

    res.json({ success: true, message: '鍙栨秷鏀惰棌鎴愬姛' });
  } catch (error) {
    console.error('鍒犻櫎鏀惰棌澶辫触:', error);
    res.status(500).json({ success: false, error: '鍒犻櫎鏀惰棌澶辫触' });
  }
});

// ============ 绗旇鏈?API ============

// 鑾峰彇鐢ㄦ埛绗旇鏈垪琛紙甯︾粺璁′俊鎭紝鍖呮嫭寰呭涔犳暟閲忥級
app.get('/api/user/notebooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT id, name, color, created_at FROM user_notebooks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // 鑾峰彇姣忎釜绗旇鏈殑缁熻淇℃伅锛堝寘鎷緟澶嶄範鏁伴噺锛?
    const notebooks = await Promise.all(result.rows.map(async (notebook) => {
      // 鑾峰彇璇嶆眹鏁伴噺
      const vocabResult = await pool.query(
        "SELECT COUNT(*) as count FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'vocab'",
        [notebook.id]
      );
      // 鑾峰彇鍙ュ瓙鏁伴噺
      const sentenceResult = await pool.query(
        "SELECT COUNT(*) as count FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'sentence'",
        [notebook.id]
      );

      const vocabCount = parseInt(vocabResult.rows[0].count);
      const sentenceCount = parseInt(sentenceResult.rows[0].count);

      // ========== 璁＄畻寰呭涔犳暟閲?==========
      // 鑾峰彇鏈瓙閲屾墍鏈夎瘝姹囩殑 item_id
      const vocabItemsResult = await pool.query(
        "SELECT item_id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'vocab'",
        [notebook.id]
      );
      const vocabItemIds = vocabItemsResult.rows.map(r => r.item_id);

      // 鑾峰彇鏈瓙閲屾墍鏈夊彞瀛愮殑 item_id
      const sentenceItemsResult = await pool.query(
        "SELECT item_id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = 'sentence'",
        [notebook.id]
      );
      const sentenceItemIds = sentenceItemsResult.rows.map(r => r.item_id);

      // 鑾峰彇杩欎簺璇嶆眹/鍙ュ瓙鐨勫涔犵姸鎬?
      let dueVocabCount = 0;
      let dueSentenceCount = 0;
      const now = new Date();
      // 璁剧疆涓轰粖澶╃殑缁撴潫鏃堕棿锛岃繖鏍?浠婂ぉ鍒版湡"鐨勯兘浼氳鍖呭惈
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (vocabItemIds.length > 0) {
        // 鏌ヨ杩欎簺璇嶆眹鐨勫涔犵姸鎬?
        const vocabStatesResult = await pool.query(
          `SELECT item_id, next_review_at FROM user_review_states 
           WHERE user_id = $1 AND item_type = 'vocab' AND item_id = ANY($2)`,
          [userId, vocabItemIds]
        );

        // 鏋勫缓宸叉湁澶嶄範鐘舵€佺殑璇嶆眹鏄犲皠
        const vocabStatesMap = new Map();
        vocabStatesResult.rows.forEach(r => {
          vocabStatesMap.set(r.item_id, r.next_review_at);
        });

        // 璁＄畻寰呭涔犳暟閲?
        vocabItemIds.forEach(itemId => {
          const nextReviewAt = vocabStatesMap.get(itemId);
          if (!nextReviewAt) {
            // 娌℃湁澶嶄範鐘舵€?= 鏂拌瘝锛岄渶瑕佸涔?
            dueVocabCount++;
          } else {
            const nextReview = new Date(nextReviewAt);
            if (nextReview <= todayEnd) {
              // 鍒版湡浜嗭紝闇€瑕佸涔?
              dueVocabCount++;
            }
          }
        });
      }

      if (sentenceItemIds.length > 0) {
        // 鏌ヨ杩欎簺鍙ュ瓙鐨勫涔犵姸鎬?
        const sentenceStatesResult = await pool.query(
          `SELECT item_id, next_review_at FROM user_review_states 
           WHERE user_id = $1 AND item_type = 'sentence' AND item_id = ANY($2)`,
          [userId, sentenceItemIds]
        );

        // 鏋勫缓宸叉湁澶嶄範鐘舵€佺殑鍙ュ瓙鏄犲皠
        const sentenceStatesMap = new Map();
        sentenceStatesResult.rows.forEach(r => {
          sentenceStatesMap.set(r.item_id, r.next_review_at);
        });

        // 璁＄畻寰呭涔犳暟閲?
        sentenceItemIds.forEach(itemId => {
          const nextReviewAt = sentenceStatesMap.get(itemId);
          if (!nextReviewAt) {
            // 娌℃湁澶嶄範鐘舵€?= 鏂板彞瀛愶紝闇€瑕佸涔?
            dueSentenceCount++;
          } else {
            const nextReview = new Date(nextReviewAt);
            if (nextReview <= todayEnd) {
              // 鍒版湡浜嗭紝闇€瑕佸涔?
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
    console.error('鑾峰彇绗旇鏈け璐?', error);
    res.status(500).json({ success: false, error: '鑾峰彇绗旇鏈け璐? });
  }
});

// 鍒涘缓绗旇鏈?
app.post('/api/user/notebooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '绗旇鏈悕绉颁笉鑳戒负绌? });
    }

    const result = await pool.query(
      'INSERT INTO user_notebooks (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, color || '#3B82F6']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('鍒涘缓绗旇鏈け璐?', error);
    res.status(500).json({ success: false, error: '鍒涘缓绗旇鏈け璐? });
  }
});

// 鏇存柊绗旇鏈紙閲嶅懡鍚嶏級
app.put('/api/user/notebooks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '绗旇鏈悕绉颁笉鑳戒负绌? });
    }

    // 妫€鏌ョ瑪璁版湰鏄惁灞炰簬璇ョ敤鎴?
    const existing = await pool.query(
      'SELECT id FROM user_notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: '绗旇鏈笉瀛樺湪' });
    }

    const result = await pool.query(
      'UPDATE user_notebooks SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name, notebookId, userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('鏇存柊绗旇鏈け璐?', error);
    res.status(500).json({ success: false, error: '鏇存柊绗旇鏈け璐? });
  }
});

// 鍒犻櫎绗旇鏈?
app.delete('/api/user/notebooks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;

    // 鍏堝垹闄ょ瑪璁版湰涓殑鎵€鏈夊唴瀹?
    await pool.query('DELETE FROM user_notebook_items WHERE notebook_id = $1 AND user_id = $2', [notebookId, userId]);

    // 鍒犻櫎绗旇鏈?
    await pool.query('DELETE FROM user_notebooks WHERE id = $1 AND user_id = $2', [notebookId, userId]);

    res.json({ success: true, message: '鍒犻櫎鎴愬姛' });
  } catch (error) {
    console.error('鍒犻櫎绗旇鏈け璐?', error);
    res.status(500).json({ success: false, error: '鍒犻櫎绗旇鏈け璐? });
  }
});

// 鑾峰彇绗旇鏈唴瀹?
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
    console.error('鑾峰彇绗旇鏈唴瀹瑰け璐?', error);
    res.status(500).json({ success: false, error: '鑾峰彇绗旇鏈唴瀹瑰け璐? });
  }
});

// 娣诲姞鍐呭鍒扮瑪璁版湰
app.post('/api/user/notebooks/:id/items', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notebookId = req.params.id;
    const { item_type, item_id, video_id } = req.body;

    console.log('娣诲姞鍒扮瑪璁版湰璇锋眰:', { userId, notebookId, item_type, item_id, video_id });

    if (!item_type || item_id === undefined || !video_id) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟' });
    }

    // 妫€鏌ョ瑪璁版湰鏄惁灞炰簬璇ョ敤鎴?
    const notebook = await pool.query(
      'SELECT id FROM user_notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, userId]
    );

    if (notebook.rows.length === 0) {
      return res.status(404).json({ success: false, error: '绗旇鏈笉瀛樺湪' });
    }

    // 缁熶竴杞崲涓哄瓧绗︿覆杩涜姣旇緝
    const itemIdStr = String(item_id);

    // 妫€鏌ユ槸鍚﹀凡娣诲姞
    const existing = await pool.query(
      'SELECT id FROM user_notebook_items WHERE notebook_id = $1 AND item_type = $2 AND item_id = $3 AND video_id = $4',
      [notebookId, item_type, itemIdStr, video_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0], message: '宸叉坊鍔犲埌绗旇鏈? });
    }

    const result = await pool.query(
      'INSERT INTO user_notebook_items (user_id, notebook_id, item_type, item_id, video_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, notebookId, item_type, itemIdStr, video_id]
    );

    console.log('娣诲姞鎴愬姛:', result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('娣诲姞鍒扮瑪璁版湰澶辫触:', error);
    res.status(500).json({ success: false, error: '娣诲姞鍒扮瑪璁版湰澶辫触: ' + error.message });
  }
});

// 浠庣瑪璁版湰鍒犻櫎鍐呭
app.delete('/api/user/notebooks/:id/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id: notebookId, itemId } = req.params;

    await pool.query(
      'DELETE FROM user_notebook_items WHERE id = $1 AND notebook_id = $2 AND user_id = $3',
      [itemId, notebookId, userId]
    );

    res.json({ success: true, message: '鍒犻櫎鎴愬姛' });
  } catch (error) {
    console.error('浠庣瑪璁版湰鍒犻櫎澶辫触:', error);
    res.status(500).json({ success: false, error: '浠庣瑪璁版湰鍒犻櫎澶辫触' });
  }
});

// ============ 澶嶄範鐘舵€?API ============

// 鑾峰彇澶嶄範鐘舵€?
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
    console.error('鑾峰彇澶嶄範鐘舵€佸け璐?', error);
    res.status(500).json({ success: false, error: '鑾峰彇澶嶄範鐘舵€佸け璐? });
  }
});

// 淇濆瓨/鏇存柊澶嶄範鐘舵€侊紙瀹炵幇闂撮殧閲嶅绠楁硶锛?
app.post('/api/user/review-states', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      item_type,
      item_id,
      video_id,
      notebook_id,
      last_result_known,  // true = 鎴戜細浜? false = 杩樹笉鐔?
    } = req.body;

    if (!item_type || item_id === undefined) {
      return res.status(400).json({ success: false, error: '缂哄皯蹇呰鍙傛暟' });
    }

    const itemIdStr = String(item_id);
    const isKnown = !!last_result_known;

    // 妫€鏌ユ槸鍚﹀凡瀛樺湪澶嶄範鐘舵€?
    const existing = await pool.query(
      'SELECT id, review_count, familiarity_level, success_streak FROM user_review_states WHERE user_id = $1 AND item_type = $2 AND item_id = $3',
      [userId, item_type, itemIdStr]
    );

    let result;
    if (existing.rows.length > 0) {
      // ========== 鏇存柊宸叉湁璁板綍 ==========
      const current = existing.rows[0];
      const oldLevel = current.familiarity_level || 0;
      const oldStreak = current.success_streak || 0;
      const oldCount = current.review_count || 0;

      // 鏍规嵁澶嶄範缁撴灉璁＄畻鏂扮殑鐘舵€?
      let newLevel, newStreak;
      if (isKnown) {
        // 绛斿锛氱啛缁冨害 +1锛岃繛缁垚鍔?+1
        newLevel = Math.min(oldLevel + 1, 10);  // 鏈€楂?10 绾?
        newStreak = oldStreak + 1;
      } else {
        // 绛旈敊锛氱啛缁冨害閲嶇疆涓?0锛岃繛缁垚鍔熼噸缃负 0
        newLevel = 0;
        newStreak = 0;
      }

      // 璁＄畻涓嬫澶嶄範鏃堕棿
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
      // ========== 鎻掑叆鏂拌褰曪紙绗竴娆″涔狅級==========
      // 绗竴娆″涔狅紝鐔熺粌搴︿粠 0 寮€濮?
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

    // 鍚屾椂璁板綍澶嶄範鏃ュ織锛堢敤浜庣粺璁★級
    try {
      await pool.query(
        'INSERT INTO user_review_logs (user_id, item_type, item_id, is_known) VALUES ($1, $2, $3, $4)',
        [userId, item_type, itemIdStr, isKnown]
      );
    } catch (logError) {
      // 鏃ュ織璁板綍澶辫触涓嶅奖鍝嶄富娴佺▼
      console.error('璁板綍澶嶄範鏃ュ織澶辫触:', logError);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('淇濆瓨澶嶄範鐘舵€佸け璐?', error);
    res.status(500).json({ success: false, error: '淇濆瓨澶嶄範鐘舵€佸け璐? });
  }
});

// ============ 澶嶄範鏃ュ織 API ============

// 鑾峰彇澶嶄範鏃ュ織缁熻
app.get('/api/user/review-logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 7;

    // 璁＄畻璧峰鏃ユ湡
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
    console.error('鑾峰彇澶嶄範鏃ュ織澶辫触:', error);
    res.status(500).json({ success: false, error: '鑾峰彇澶嶄範鏃ュ織澶辫触' });
  }
});

// ============ Azure TTS API ============

// GET /api/tts - 鏂囨湰杞闊筹紙涓嶉渶瑕佺櫥褰曪級
app.get('/api/tts', async (req, res) => {
  try {
    const { text, accent = 'us' } = req.query;

    if (!text) {
      return res.status(400).json({ success: false, message: '缂哄皯 text 鍙傛暟' });
    }

    // 閫夋嫨璇煶
    const voice = VOICE_MAP[accent] || VOICE_MAP['us'];

    // 鏋勫缓 SSML
    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
        <voice name='${voice}'>
          ${text}
        </voice>
      </speak>
    `;

    // 璋冪敤 Azure TTS API
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
      return res.status(500).json({ success: false, message: 'TTS 鏈嶅姟閿欒' });
    }

    // 杩斿洖闊抽娴?
    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400' // 缂撳瓨 1 澶?
    });

    const audioBuffer = await response.arrayBuffer();
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ success: false, message: '鏈嶅姟鍣ㄩ敊璇? });
  }
});

// 鍋ュ悍妫€鏌?
app.get('/', (req, res) => {
  res.send('BiuBiu API is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
