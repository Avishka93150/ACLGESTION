const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/my-data', requireAuth, async (req, res) => {
  try {
    const { User, LeaveRequest, MaintenanceTicket, AccessLog } = require('../models');
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    const leaves = await LeaveRequest.findAll({ where: { employee_id: req.user.id } });
    const tickets = await MaintenanceTicket.findAll({ where: { reported_by: req.user.id } });
    const logs = await AccessLog.findAll({ where: { user_id: req.user.id }, limit: 100, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: { user, leaves, tickets, access_logs: logs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/export', requireAuth, async (req, res) => {
  try {
    const { User, LeaveRequest, MaintenanceTicket, Evaluation, AccessLog } = require('../models');
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    const data = {
      personal_info: user,
      leave_requests: await LeaveRequest.findAll({ where: { employee_id: req.user.id } }),
      maintenance_tickets: await MaintenanceTicket.findAll({ where: { reported_by: req.user.id } }),
      evaluations: await Evaluation.findAll({ where: { evaluated_user_id: req.user.id } }),
      access_logs: await AccessLog.findAll({ where: { user_id: req.user.id } }),
      export_date: new Date().toISOString()
    };
    res.json({ success: true, data, message: 'Export des donnees personnelles' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delete', requireAuth, async (req, res) => {
  try {
    const { User, AccessLog } = require('../models');
    await AccessLog.create({
      user_id: req.user.id, action: 'deletion_request', resource: 'user',
      resource_id: req.user.id, ip_address: req.ip, user_agent: req.get('User-Agent')
    });
    res.json({
      success: true,
      message: 'Demande de suppression enregistree. Un administrateur traitera votre demande sous 30 jours.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { AccessLog, User } = require('../models');
    const where = {};
    if (req.query.user_id) where.user_id = req.query.user_id;
    if (req.query.action) where.action = req.query.action;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { rows, count } = await AccessLog.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit, offset: (page - 1) * limit
    });
    res.json({ success: true, logs: rows, total: count, page, pages: Math.ceil(count / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/consents', requireAuth, async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.user.id, { attributes: ['gdpr_consent', 'gdpr_consent_date'] });
    res.json({ success: true, consent: { given: !!user.gdpr_consent, date: user.gdpr_consent_date } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/consent', requireAuth, async (req, res) => {
  try {
    const { User } = require('../models');
    await User.update(
      { gdpr_consent: req.body.consent ? 1 : 0, gdpr_consent_date: new Date() },
      { where: { id: req.user.id } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
