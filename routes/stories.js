const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/storyController');

router.get('/feed/:userId', ctrl.getActive);   // GET  /api/stories/feed/:userId
router.get('/my/:userId',   ctrl.getMine);     // GET  /api/stories/my/:userId
router.post('/mute',        ctrl.toggleMute);  // POST /api/stories/mute
router.post('/',            ctrl.create);      // POST /api/stories
router.post('/:id/view',    ctrl.addView);     // POST /api/stories/:id/view
router.delete('/:id',       ctrl.delete);      // DEL  /api/stories/:id

module.exports = router;