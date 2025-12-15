import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  database: process.env.RDS_DB,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: false,
});

export default async function handler(req, res) {
  try {
    const result = await pool.query(`
      SELECT id, title, episode
      FROM videos
      ORDER BY episode
      LIMIT 5;
    `);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
