const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host:               process.env.DB_HOST     || '138.59.135.33',
  user:               process.env.DB_USER     || 'ProyectoConnex',
  password:           process.env.DB_PASSWORD || 'ProyectoConnex@',
  database:           process.env.DB_NAME     || 'ConnexV1',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4'
});