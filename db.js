// ============================================================
// db.js - Conexión a MySQL con pool de conexiones
// ============================================================
const mysql = require('mysql2');

const DB_HOST = process.env.DB_HOST     || '138.59.135.33';
const DB_USER = process.env.DB_USER     || 'ProyectoConnex';
const DB_PASS = process.env.DB_PASSWORD || 'ProyectoConnex@';
const DB_NAME = process.env.DB_NAME     || 'ConnexV1';

console.log(`🔧 Conectando a MySQL: ${DB_USER}@${DB_HOST}/${DB_NAME}`);

const pool = mysql.createPool({
  host:               DB_HOST,
  user:               DB_USER,
  password:           DB_PASS,
  database:           DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4'
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌  Error conectando a MySQL:', err.message);
    console.error(`    → DB_HOST=${DB_HOST}  DB_USER=${DB_USER}  DB_NAME=${DB_NAME}`);
  } else {
    console.log('✅  Conexión a MySQL exitosa');
    connection.release();
  }
});

module.exports = pool; // <-- solo esta línea, sin la de abajo