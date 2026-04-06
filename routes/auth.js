// ============================================================
// routes/auth.js
// ============================================================
const express = require('express');
const router  = express.Router();
const { login, getUsers } = require('../controllers/authController');

router.post('/login', login);
router.get('/users',  getUsers);

module.exports = router;
