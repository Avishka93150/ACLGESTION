const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/config/:hotelId', requireAuth, async (req, res) => {
  try {
    const { LinenConfig } = require('../models');
    const config = await LinenConfig.findAll({ where: { hotel_id: req.params.hotelId, is_active: 1 } });
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/config/:hotelId', requireAuth, requirePermission('linen.config'), async (req, res) => {
  try {
    const { LinenConfig } = require('../models');
    const { items } = req.body;
    if (items) {
      for (const item of items) {
        if (item.id) {
          await LinenConfig.update({ linen_type: item.linen_type, is_active: item.is_active }, { where: { id: item.id } });
        } else {
          await LinenConfig.create({ hotel_id: req.params.hotelId, linen_type: item.linen_type, is_active: 1 });
        }
      }
    }
    const config = await LinenConfig.findAll({ where: { hotel_id: req.params.hotelId } });
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { LinenTransaction, User, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.type) where.transaction_type = req.query.type;
    if (req.query.start_date && req.query.end_date) {
      const { Op } = require('sequelize');
      where.transaction_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }
    const transactions = await LinenTransaction.findAll({
      where, include: [
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ],
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(req.query.limit) || 200
    });
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/transactions', requireAuth, requirePermission('linen.manage'), async (req, res) => {
  try {
    const { LinenTransaction } = require('../models');
    const transaction = await LinenTransaction.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
