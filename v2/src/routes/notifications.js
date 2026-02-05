const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { Notification } = require('../models');
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['is_read', 'ASC'], ['created_at', 'DESC']],
      limit: 50
    });
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { Notification } = require('../models');
    await Notification.update({ is_read: 1 }, { where: { id: req.params.id, user_id: req.user.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const { Notification } = require('../models');
    await Notification.update({ is_read: 1 }, { where: { user_id: req.user.id, is_read: 0 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { Notification } = require('../models');
    await Notification.destroy({ where: { id: req.params.id, user_id: req.user.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/all', requireAuth, async (req, res) => {
  try {
    const { Notification } = require('../models');
    await Notification.destroy({ where: { user_id: req.user.id, is_read: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
