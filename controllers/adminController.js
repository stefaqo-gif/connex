// ============================================================
// controllers/adminController.js  –  Dashboard Admin
// ============================================================
const User    = require('../models/User');
const Message = require('../models/Message');

/**
 * GET /api/admin/stats
 * Retorna estadísticas globales + mensajes por día.
 * El número de usuarios conectados se inyecta desde el mapa en memoria.
 */
exports.getStats = (onlineMap) => async (req, res) => {
  try {
    const [totalUsers, totalMessages, perDay] = await Promise.all([
      User.count(),
      Message.count(),
      Message.perDay()
    ]);

    res.json({
      totalUsers,
      totalMessages,
      connectedUsers: onlineMap.size,
      perDay
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
