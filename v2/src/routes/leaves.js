const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { Op } = require('sequelize');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { LeaveRequest, User, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.employee_id) where.employee_id = req.query.employee_id;
    // Employes: seulement leurs propres demandes
    if (['employee', 'receptionniste'].includes(req.user.role)) {
      where.employee_id = req.user.id;
    }
    const requests = await LeaveRequest.findAll({
      where,
      include: [
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'role'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(req.query.limit) || 100
    });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('leaves.create'), async (req, res) => {
  try {
    const { LeaveRequest } = require('../models');
    const { leave_type, start_date, end_date, days, comment, hotel_id } = req.body;
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Type, date debut et fin requis' });
    }
    const request = await LeaveRequest.create({
      employee_id: req.user.id, hotel_id, leave_type,
      start_date, end_date, days: days || 1, comment,
      status: 'pending'
    });
    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/pending', requireAuth, async (req, res) => {
  try {
    const { LeaveRequest, User, Hotel } = require('../models');
    const where = { status: 'pending' };
    if (!['admin', 'groupe_manager'].includes(req.user.role)) {
      where.hotel_id = req.userHotelIds || [];
    }
    const requests = await LeaveRequest.findAll({
      where,
      include: [
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'ASC']]
    });
    res.json({ success: true, requests, count: requests.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/balance', requireAuth, async (req, res) => {
  try {
    const { LeaveBalance } = require('../models');
    const userId = req.query.user_id || req.user.id;
    const year = req.query.year || new Date().getFullYear();
    let balance = await LeaveBalance.findOne({ where: { user_id: userId, year } });
    if (!balance) {
      balance = await LeaveBalance.create({
        user_id: userId, year, cp_total: 25, cp_used: 0, rtt_total: 10, rtt_used: 0
      });
    }
    res.json({ success: true, balance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/approve', requireAuth, requirePermission('leaves.validate'), async (req, res) => {
  try {
    const { LeaveRequest, LeaveBalance } = require('../models');
    const request = await LeaveRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Demande deja traitee' });
    }
    await request.update({ status: 'approved', approved_by: req.user.id, approved_at: new Date() });
    // Mettre a jour le solde
    const year = new Date(request.start_date).getFullYear();
    const balance = await LeaveBalance.findOne({ where: { user_id: request.employee_id, year } });
    if (balance && ['cp', 'rtt'].includes(request.leave_type)) {
      const field = request.leave_type === 'cp' ? 'cp_used' : 'rtt_used';
      await balance.update({ [field]: parseFloat(balance[field]) + parseFloat(request.days) });
    }
    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/reject', requireAuth, requirePermission('leaves.validate'), async (req, res) => {
  try {
    const { LeaveRequest } = require('../models');
    const request = await LeaveRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    await request.update({
      status: 'rejected', approved_by: req.user.id,
      approved_at: new Date(), rejection_reason: req.body.reason || ''
    });
    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/report', requireAuth, async (req, res) => {
  try {
    const { LeaveRequest, sequelize } = require('../models');
    const year = req.query.year || new Date().getFullYear();
    const stats = await LeaveRequest.findAll({
      attributes: [
        'leave_type', 'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('days')), 'total_days']
      ],
      where: sequelize.where(sequelize.fn('YEAR', sequelize.col('start_date')), year),
      group: ['leave_type', 'status']
    });
    res.json({ success: true, stats, year });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/for-other', requireAuth, requirePermission('leaves.manage_all'), async (req, res) => {
  try {
    const { LeaveRequest } = require('../models');
    const request = await LeaveRequest.create({
      ...req.body, status: 'approved',
      approved_by: req.user.id, approved_at: new Date()
    });
    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
