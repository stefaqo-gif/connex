const Story = require('../models/Story');

// GET /api/stories/feed/:userId
exports.getActive = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const stories = await Story.getActive(userId);
    res.json(stories); // array directo
  } catch (err) {
    console.error('❌ getActive error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

// GET /api/stories/my/:userId
exports.getMine = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const stories = await Story.getMyStories(userId);
    res.json(stories); // array directo
  } catch (err) {
    console.error('❌ getMine error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

// POST /api/stories
exports.create = async (req, res) => {
  try {
    const { userId, content, bgColor, imageUrl } = req.body;
    if (!userId || (!content && !imageUrl)) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const story = await Story.create({ userId, content, bgColor: bgColor || '#25D366', imageUrl: imageUrl || null });
    res.json({ story });
  } catch (err) {
    console.error('❌ create story error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

// POST /api/stories/:id/view
exports.addView = async (req, res) => {
  try {
    const { viewerId } = req.body;
    const { id } = req.params;
    await Story.addView(id, viewerId);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ addView error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

// DELETE /api/stories/:id
exports.delete = async (req, res) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;
    const deleted = await Story.delete(id, userId);
    if (!deleted) return res.status(403).json({ error: 'No autorizado o no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ delete story error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};

// POST /api/stories/mute
exports.toggleMute = async (req, res) => {
  try {
    const { muterId, mutedId } = req.body;
    const muted = await Story.toggleMute(muterId, mutedId);
    res.json({ muted });
  } catch (err) {
    console.error('❌ toggleMute error:', err.message);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};