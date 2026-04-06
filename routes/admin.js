// ============================================================
// routes/admin.js
// ============================================================
const express = require('express');
const router  = express.Router();
const adminCtrl = require('../controllers/adminController');

// onlineMap se inyecta desde server.js
module.exports = (onlineMap) => {
  router.get('/stats', adminCtrl.getStats(onlineMap));
  return router;
};
