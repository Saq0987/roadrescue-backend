// config/db.js — MySQL Connection Pool
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'roadrescue',
  waitForConnections: true,
  connectionLimit:    5,
  queueLimit:         0,
  timezone:           '+00:00',
  connectTimeout:     10000,
  ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    // Don't exit — let Vercel handle it gracefully
  }
})();

module.exports = pool;