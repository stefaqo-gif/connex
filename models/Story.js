// ============================================================
// models/Story.js
// ============================================================
const db = require('../db-promise');
const Story = {

 async create({ userId, content, bgColor = '#25D366', imageUrl = null }) {
  // Guardamos imagen en archivo_url si hay, si no el color hex
  const archivoUrl = imageUrl || bgColor;
  const [result] = await db.execute(
    `INSERT INTO estados (id_usuario, archivo_url, texto_estado, es_activo)
     VALUES (?, ?, ?, 1)`,
    [parseInt(userId, 10), archivoUrl, content || '']
  );
  return { id: String(result.insertId), userId, content, bgColor, imageUrl };
},

  async getActive(currentUserId) {
    const [rows] = await db.execute(
      `SELECT
         e.id_estado         AS id,
         e.id_usuario        AS user_id,
         e.texto_estado      AS content,
         e.archivo_url       AS archivo_url,
         e.fecha_publicacion AS created_at,
         u.nombre_usuario    AS username,
         u.foto_url          AS avatar,
         (SELECT COUNT(*) FROM estados_vistos ev WHERE ev.id_estado = e.id_estado) AS view_count,
         EXISTS(
           SELECT 1 FROM estados_vistos ev2
           WHERE ev2.id_estado = e.id_estado AND ev2.id_usuario_lector = ?
         ) AS viewed_by_me
       FROM estados e
       JOIN usuarios u ON u.id_usuario = e.id_usuario
       WHERE e.es_activo = 1
         AND e.id_usuario NOT IN (
           SELECT id_contacto_silenciado FROM estados_silenciados WHERE id_usuario = ?
         )
       ORDER BY e.fecha_publicacion DESC`,
      [parseInt(currentUserId, 10), parseInt(currentUserId, 10)]
    );
    return rows.map(normalizeStory);
  },

  async getMyStories(userId) {
    const [rows] = await db.execute(
      `SELECT
         e.id_estado         AS id,
         e.texto_estado      AS content,
         e.archivo_url       AS archivo_url,
         e.fecha_publicacion AS created_at,
         u.nombre_usuario    AS username,
         (SELECT COUNT(*) FROM estados_vistos ev WHERE ev.id_estado = e.id_estado) AS view_count
       FROM estados e
       JOIN usuarios u ON u.id_usuario = e.id_usuario
       WHERE e.id_usuario = ? AND e.es_activo = 1
       ORDER BY e.fecha_publicacion DESC`,
      [parseInt(userId, 10)]
    );
    return rows.map(normalizeStory);
  },

  async addView(storyId, viewerId) {
    try {
      await db.execute(
        `INSERT IGNORE INTO estados_vistos (id_estado, id_usuario_lector) VALUES (?, ?)`,
        [parseInt(storyId, 10), parseInt(viewerId, 10)]
      );
    } catch(e) {}
  },

  async delete(storyId, userId) {
    const [result] = await db.execute(
      'UPDATE estados SET es_activo = 0 WHERE id_estado = ? AND id_usuario = ?',
      [parseInt(storyId, 10), parseInt(userId, 10)]
    );
    return result.affectedRows > 0;
  },

  async toggleMute(muterId, mutedId) {
    const [rows] = await db.execute(
      'SELECT 1 FROM estados_silenciados WHERE id_usuario = ? AND id_contacto_silenciado = ?',
      [parseInt(muterId, 10), parseInt(mutedId, 10)]
    );
    if (rows.length) {
      await db.execute(
        'DELETE FROM estados_silenciados WHERE id_usuario = ? AND id_contacto_silenciado = ?',
        [parseInt(muterId, 10), parseInt(mutedId, 10)]
      );
      return false;
    } else {
      await db.execute(
        'INSERT INTO estados_silenciados (id_usuario, id_contacto_silenciado) VALUES (?, ?)',
        [parseInt(muterId, 10), parseInt(mutedId, 10)]
      );
      return true;
    }
  },

  async purgeExpired() {
    const [result] = await db.execute(
      `UPDATE estados SET es_activo = 0
       WHERE es_activo = 1 AND fecha_publicacion < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    return result.affectedRows;
  }
};

// archivo_url puede ser un color hex (#25D366) o una URL de imagen (/uploads/...)
function normalizeStory(row) {
  const archivo = row.archivo_url || '';
  // Es imagen si empieza con / o http (URL), no con # (color hex)
  const isImage = archivo.startsWith('/') || archivo.startsWith('http');
  return {
    ...row,
    bg_color:  isImage ? '#25D366' : (archivo || '#25D366'),
    image_url: isImage ? archivo : null,
  };

}

module.exports = Story;