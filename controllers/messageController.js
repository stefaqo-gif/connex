// ============================================================
// controllers/messageController.js
// ============================================================
const Message = require('../models/Message');

exports.getConversation = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const mensajes = await Message.getConversation(user1, user2);
    res.json({ mensajes }); // ← consistente con el frontend
  } catch (err) {
    console.error('❌ getConversation error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};
// Buscar usuarios por nombre o username (para iniciar chat con desconocidos)
exports.buscarUsuarios = async (req, res) => {
  try {
    const { q } = req.query;
    const { userId } = req.params;
    if (!q || q.trim().length < 2) return res.json({ usuarios: [] });

    const [rows] = await db.query(
      `SELECT id, nombre, username, foto_url
       FROM usuarios
       WHERE (nombre LIKE ? OR username LIKE ?)
         AND id != ?
       LIMIT 20`,
      [`%${q}%`, `%${q}%`, userId]
    );
    res.json({ usuarios: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};