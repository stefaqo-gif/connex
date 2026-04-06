const db = require('../db');

// Una sola instancia del pool con promesas
const dbp = db.promise();

const Message = {

 async create({ senderId, receiverId, content, msgType = 'text', archivoBase64 = null }) {
    const tipo = msgType === 'text' ? 'texto' : msgType;
    const [result] = await dbp.execute(
        `INSERT INTO mensajes (id_emisor, id_receptor_usuario, contenido_texto, tipo_multimedia, archivo_url, leido)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [parseInt(senderId, 10), parseInt(receiverId, 10), content, tipo, archivoBase64]
    );
    return { id: String(result.insertId), senderId, receiverId, content, msgType, archivoBase64, status: 'sent' };
},

  async getConversation(user1, user2, limit = 100) {
    const u1  = parseInt(user1, 10);
    const u2  = parseInt(user2, 10);
    const lim = parseInt(limit, 10);
    const [rows] = await dbp.execute(
      `SELECT
         m.id_mensaje      AS id,
         m.id_emisor       AS sender_id,
         m.contenido_texto AS content,
         m.tipo_multimedia AS msg_type,
         m.leido,
         m.fecha_envio     AS created_at,
         u.nombre_usuario  AS sender_name,
         CASE WHEN m.leido = 1 THEN 'seen' ELSE 'sent' END AS status
       FROM mensajes m
       JOIN usuarios u ON u.id_usuario = m.id_emisor
       WHERE m.id_receptor_grupo IS NULL
         AND (
           (m.id_emisor = ? AND m.id_receptor_usuario = ?)
           OR
           (m.id_emisor = ? AND m.id_receptor_usuario = ?)
         )
       ORDER BY m.fecha_envio ASC
       LIMIT ${lim}`,
      [u1, u2, u2, u1]
    );
    return rows;
  },

  async markDelivered(messageIds) {
    if (!messageIds || !messageIds.length) return;
    const ids = messageIds.map(id => parseInt(id, 10));
    const placeholders = ids.map(() => '?').join(',');
    await dbp.execute(
      `UPDATE mensajes SET leido = 1 WHERE id_mensaje IN (${placeholders}) AND leido = 0`,
      ids
    );
  },

  async markSeen(senderId, receiverId) {
    await dbp.execute(
      `UPDATE mensajes SET leido = 1
       WHERE id_emisor = ? AND id_receptor_usuario = ? AND leido = 0`,
      [parseInt(senderId, 10), parseInt(receiverId, 10)]
    );
  },

  async getPendingForReceiver(receiverId) {
    const [rows] = await dbp.execute(
      `SELECT id_mensaje AS id, id_emisor AS sender_id, id_receptor_usuario AS receiver_id,
              contenido_texto AS content, tipo_multimedia AS msg_type, fecha_envio AS created_at
       FROM mensajes
       WHERE id_receptor_usuario = ? AND leido = 0 AND id_receptor_grupo IS NULL`,
      [parseInt(receiverId, 10)]
    );
    return rows;
  },

  async count() {
    const [rows] = await dbp.execute('SELECT COUNT(*) AS total FROM mensajes');
    return rows[0].total;
  },

  async perDay() {
    const [rows] = await dbp.execute(
      `SELECT DATE(fecha_envio) AS day, COUNT(*) AS total
       FROM mensajes
       WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(fecha_envio)
       ORDER BY day ASC`
    );
    return rows;
  }
};

module.exports = Message;