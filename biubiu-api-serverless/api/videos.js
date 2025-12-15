import pg from 'pg';
const { Pool } = pg;
// 创建数据库连接池
const pool = new Pool({
  host: process.env.RDS_HOST,
  port: parseInt(process.env.RDS_PORT || '5432'),
  database: process.env.RDS_DB,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: false, // 阿里云 RDS 内网不需要 SSL
  max: 10, // 连接池最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
export default async function handler(req, res) {
  // 设置 CORS 头（允许前端跨域调用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed' 
    });
  }
  let client;
  try {
    // 从连接池获取客户端
    client = await pool.connect();
    
    // 查询所有视频（按 episode 排序）
    const result = await client.query(`
      SELECT 
        id,
        episode,
        title,
        transcript,
        vocab
      FROM videos
      ORDER BY episode ASC
    `);
    // 返回成功响应
    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
  } finally {
    // 释放客户端回连接池
    if (client) {
      client.release();
    }
  }
}