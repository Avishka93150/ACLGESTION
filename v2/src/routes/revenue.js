const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { RevenueEntry, Hotel, User } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.start_date && req.query.end_date) {
      where.entry_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }
    const entries = await RevenueEntry.findAll({
      where,
      include: [
        { model: Hotel, attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['entry_date', 'DESC']],
      limit: parseInt(req.query.limit) || 200
    });
    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { RevenueEntry } = require('../models');
    const entry = await RevenueEntry.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { RevenueEntry, sequelize } = require('../models');
    const hotelId = req.query.hotel_id;
    const year = req.query.year || new Date().getFullYear();
    const where = {};
    if (hotelId) where.hotel_id = hotelId;
    where.entry_date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    const monthly = await RevenueEntry.findAll({
      attributes: [
        [sequelize.fn('MONTH', sequelize.col('entry_date')), 'month'],
        [sequelize.fn('AVG', sequelize.col('rate')), 'avg_rate'],
        [sequelize.fn('AVG', sequelize.col('occupancy_rate')), 'avg_occupancy'],
        [sequelize.fn('AVG', sequelize.col('revpar')), 'avg_revpar'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'entries']
      ],
      where, group: [sequelize.fn('MONTH', sequelize.col('entry_date'))],
      order: [[sequelize.fn('MONTH', sequelize.col('entry_date')), 'ASC']]
    });
    res.json({ success: true, stats: monthly, year });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export', requireAuth, async (req, res) => {
  try {
    const { RevenueEntry, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.start_date && req.query.end_date) {
      where.entry_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }
    const entries = await RevenueEntry.findAll({
      where, include: [{ model: Hotel, attributes: ['name'] }],
      order: [['entry_date', 'ASC']]
    });
    res.json({ success: true, entries, export_date: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
