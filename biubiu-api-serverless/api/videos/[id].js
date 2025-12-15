import pg from 'pg';
const { Pool } = pg;

// 创建数据库连接池
const pool = new Pool({
  host: process.env.RDS_HOST,
  port: parseInt(process.env.RDS_PORT || '5432'),
  database: process.env.RDS_DB,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed' 
    });
  }

  // 从 URL 中获取视频 ID
  // Vercel 会把 /api/videos/123 的 123 放在 req.query.id 中
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing video ID'
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // 查询指定 ID 的视频
    const result = await client.query(`
      SELECT 
        id,
        episode,
        title,
        transcript,
        vocab,
        created_at
      FROM videos
      WHERE id = $1
    `, [id]);

    // 检查是否找到视频
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
        id: parseInt(id)
      });
    }

    // 返回视频详情
    return res.status(200).json({
      success: true,
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message
    });
    
  } finally {
    if (client) {
      client.release();
    }
  }
}
