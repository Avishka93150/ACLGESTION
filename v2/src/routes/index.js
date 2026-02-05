/**
 * ACL GESTION v2 - Main API Router
 */
const router = require('express').Router();
const { apiLimiter } = require('../middleware/rateLimit');

router.use(apiLimiter);
router.use('/auth', require('./auth'));
router.use('/hotels', require('./hotels'));
router.use('/rooms', require('./rooms'));
router.use('/maintenance', require('./maintenance'));
router.use('/dispatch', require('./dispatch'));
router.use('/tasks', require('./tasks'));
router.use('/evaluations', require('./evaluations'));
router.use('/leaves', require('./leaves'));
router.use('/linen', require('./linen'));
router.use('/closures', require('./closures'));
router.use('/users', require('./users'));
router.use('/notifications', require('./notifications'));
router.use('/messages', require('./messaging'));
router.use('/settings', require('./settings'));
router.use('/rgpd', require('./rgpd'));
router.use('/automations', require('./automations'));
router.use('/dashboard', require('./dashboard'));
router.use('/contact', require('./contact'));
router.use('/audit', require('./audit'));
router.use('/revenue', require('./revenue'));

router.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), version: '2.0.0' });
});

module.exports = router;
