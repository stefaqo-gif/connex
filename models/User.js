// ============================================================
// models/User.js  –  CRUD de usuarios (tabla: usuarios)
// ============================================================
const db  = require('../db');
const dbp = db.promise(); 

const User = {

  /** Buscar por nombre_usuario */
  async findByUsername(nombre_usuario) {
    const [rows] = await db.execute(
      'SELECT id_usuario AS id, nombre_usuario AS username, foto_url AS avatar, info_estado AS status_msg FROM usuarios WHERE nombre_usuario = ?',
      [nombre_usuario]
    );
    return rows[0] || null;
  },

  /** Buscar por id */
  async findById(id) {
    const [rows] = await db.execute(
      'SELECT id_usuario AS id, nombre_usuario AS username, foto_url AS avatar, info_estado AS status_msg FROM usuarios WHERE id_usuario = ?',
      [id]
    );
    return rows[0] || null;
  },

  /** Listar todos los usuarios */
  async getAll() {
    const [rows] = await db.execute(
      'SELECT id_usuario AS id, nombre_usuario AS username, foto_url AS avatar, info_estado AS status_msg FROM usuarios ORDER BY nombre_usuario ASC'
    );
    return rows;
  },

  /** Actualizar last_seen (no existe en esta BD, ignorar silenciosamente) */
  async touchLastSeen(id) {
    // La tabla usuarios no tiene last_seen; operación silenciosa
    return;
  },

  /** Estadísticas admin */
  async count() {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM usuarios');
    return rows[0].total;
  }
};

module.exports = User;
