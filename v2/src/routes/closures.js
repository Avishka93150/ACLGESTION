const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { Op } = require('sequelize');

router.get('/daily', requireAuth, async (req, res) => {
  try {
    const { DailyClosure, User, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.start_date && req.query.end_date) {
      where.closure_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }
    const closures = await DailyClosure.findAll({
      where, include: [
        { model: Hotel, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['closure_date', 'DESC']],
      limit: parseInt(req.query.limit) || 100
    });
    res.json({ success: true, closures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/daily', requireAuth, requirePermission('closures.create'), async (req, res) => {
  try {
    const { DailyClosure } = require('../models');
    const { hotel_id, closure_date, cash_opening, cash_closing, notes } = req.body;
    const diff = parseFloat(cash_closing || 0) - parseFloat(cash_opening || 0);
    const [closure, created] = await DailyClosure.findOrCreate({
      where: { hotel_id, closure_date },
      defaults: {
        hotel_id, closure_date, cash_opening, cash_closing,
        cash_difference: diff, notes, status: 'draft',
        created_by: req.user.id
      }
    });
    if (!created) {
      await closure.update({ cash_opening, cash_closing, cash_difference: diff, notes });
    }
    res.status(created ? 201 : 200).json({ success: true, closure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/daily/:id', requireAuth, async (req, res) => {
  try {
    const { DailyClosure, User, Hotel } = require('../models');
    const closure = await DailyClosure.findByPk(req.params.id, {
      include: [
        { model: Hotel, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });
    if (!closure) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });
    res.json({ success: true, closure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/daily/:id', requireAuth, async (req, res) => {
  try {
    const { DailyClosure } = require('../models');
    const closure = await DailyClosure.findByPk(req.params.id);
    if (!closure) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });
    const updates = { ...req.body };
    if (updates.cash_opening !== undefined || updates.cash_closing !== undefined) {
      const opening = parseFloat(updates.cash_opening ?? closure.cash_opening ?? 0);
      const closing = parseFloat(updates.cash_closing ?? closure.cash_closing ?? 0);
      updates.cash_difference = closing - opening;
    }
    await closure.update(updates);
    res.json({ success: true, closure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/daily/:id/validate', requireAuth, requirePermission('closures.validate'), async (req, res) => {
  try {
    const { DailyClosure } = require('../models');
    const closure = await DailyClosure.findByPk(req.params.id);
    if (!closure) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });
    await closure.update({ status: 'validated', validated_by: req.user.id, validated_at: new Date() });
    res.json({ success: true, closure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const { MonthlyClosure, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.year) where.year = req.query.year;
    const closures = await MonthlyClosure.findAll({
      where, include: [{ model: Hotel, attributes: ['id', 'name'] }],
      order: [['year', 'DESC'], ['month', 'DESC']]
    });
    res.json({ success: true, closures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/config/:hotelId', requireAuth, async (req, res) => {
  try {
    const { ClosureConfig } = require('../models');
    const config = await ClosureConfig.findAll({
      where: { hotel_id: req.params.hotelId },
      order: [['position', 'ASC']]
    });
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/config', requireAuth, async (req, res) => {
  try {
    const { ClosureConfig } = require('../models');
    const config = await ClosureConfig.create(req.body);
    res.status(201).json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/alerts', requireAuth, async (req, res) => {
  try {
    const { DailyClosure, Hotel } = require('../models');
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const hotels = await Hotel.findAll({ where: { status: 'active' } });
    const alerts = [];
    for (const hotel of hotels) {
      const closure = await DailyClosure.findOne({
        where: { hotel_id: hotel.id, closure_date: yesterday }
      });
      if (!closure) {
        alerts.push({ hotel_id: hotel.id, hotel_name: hotel.name, date: yesterday, type: 'missing' });
      }
    }
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
