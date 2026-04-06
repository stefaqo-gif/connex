// ============================================================
// routes/messages.js
// ============================================================
const express = require('express');
const router  = express.Router();
const { getConversation, buscarUsuarios } = require('../controllers/messageController');

router.get('/buscar-usuarios/:userId', buscarUsuarios);
router.get('/:user1/:user2', getConversation);

module.exports = router;