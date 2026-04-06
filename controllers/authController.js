// ============================================================
// controllers/authController.js  –  Sin login: selección directa
// ============================================================
const User = require('../models/User');

/**
 * POST /api/auth/login
 * Body: { userId }  — selecciona un usuario existente por ID
 */
exports.login = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({ user });
  } catch (err) {
    console.error('❌ login error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

/**
 * GET /api/auth/users
 * Lista todos los usuarios (pantalla de selección)
 */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (err) {
    console.error('❌ getUsers error:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};
