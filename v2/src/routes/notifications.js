/**
 * ACL GESTION v2 - Notifications Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// GET /notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await query(
      'SELECT * FROM notifications WHERE user_id = :userId ORDER BY is_read ASC, created_at DESC LIMIT 50',
      { userId: req.user.id }
    );
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /notifications/:id/read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notifs = await query('SELECT * FROM notifications WHERE id = :id AND user_id = :userId', { id: req.params.id, userId: req.user.id });
    if (notifs.length === 0) return res.status(404).json({ success: false, message: 'Notification non trouvee' });

    await sequelize.query('UPDATE notifications SET is_read = 1 WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ success: true, message: 'Notification marquee comme lue' });
  } catch (error) {
    console.error('Read notification error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /notifications/read-all
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await sequelize.query('UPDATE notifications SET is_read = 1 WHERE user_id = :userId AND is_read = 0', { replacements: { userId: req.user.id } });
    res.json({ success: true, message: 'Toutes les notifications marquees comme lues' });
  } catch (error) {
    console.error('Read all notifications error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /notifications/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notifs = await query('SELECT * FROM notifications WHERE id = :id AND user_id = :userId', { id: req.params.id, userId: req.user.id });
    if (notifs.length === 0) return res.status(404).json({ success: false, message: 'Notification non trouvee' });

    await sequelize.query('DELETE FROM notifications WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ success: true, message: 'Notification supprimee' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /notifications/all
router.delete('/all', requireAuth, async (req, res) => {
  try {
    await sequelize.query('DELETE FROM notifications WHERE user_id = :userId AND is_read = 1', { replacements: { userId: req.user.id } });
    res.json({ success: true, message: 'Notifications lues supprimees' });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
