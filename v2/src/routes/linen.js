/**
 * ACL GESTION v2 - Linen Management Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { LinenConfig, LinenTransaction, Hotel, User, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /linen/config/:hotelId
router.get('/config/:hotelId', requireAuth, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId, 10);
    const hotel = await Hotel.findByPk(hotelId);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel non trouve' });

    let config = await LinenConfig.findOne({ where: { hotel_id: hotelId } });
    if (!config) {
      config = { hotel_id: hotelId, linen_type: null, is_active: 1 };
    }
    res.json({ success: true, config });
  } catch (error) {
    console.error('Get linen config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /linen/config/:hotelId
router.put('/config/:hotelId', requireAuth, requirePermission('linen.config'), async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId, 10);
    const hotel = await Hotel.findByPk(hotelId);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel non trouve' });

    let config = await LinenConfig.findOne({ where: { hotel_id: hotelId } });
    const updateData = {};
    if (req.body.linen_type !== undefined) updateData.linen_type = req.body.linen_type;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    if (config) {
      await config.update(updateData);
    } else {
      config = await LinenConfig.create({ hotel_id: hotelId, ...updateData });
    }
    res.json({ success: true, message: 'Configuration mise a jour', config });
  } catch (error) {
    console.error('Update linen config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /linen/transactions
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.hotel_id) {
      where.hotel_id = parseInt(req.query.hotel_id, 10);
    } else if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      where.hotel_id = { [Op.in]: userHotels.map(uh => uh.hotel_id) };
    }
    if (req.query.type) where.transaction_type = req.query.type;
    if (req.query.date_from || req.query.date_to) {
      where.transaction_date = {};
      if (req.query.date_from) where.transaction_date[Op.gte] = req.query.date_from;
      if (req.query.date_to) where.transaction_date[Op.lte] = req.query.date_to;
    }

    const transactions = await LinenTransaction.findAll({
      where,
      order: [['transaction_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 100
    });

    const hotelIds = [...new Set(transactions.map(t => t.hotel_id))];
    const creatorIds = [...new Set(transactions.map(t => t.created_by))];
    const hotels = hotelIds.length > 0 ? await Hotel.findAll({ where: { id: { [Op.in]: hotelIds } }, attributes: ['id', 'name'] }) : [];
    const users = creatorIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: creatorIds } }, attributes: ['id', 'first_name', 'last_name'] }) : [];
    const hotelMap = {}; hotels.forEach(h => { hotelMap[h.id] = h.name; });
    const userMap = {}; users.forEach(u => { userMap[u.id] = u.first_name + ' ' + u.last_name; });

    const enriched = transactions.map(t => ({
      ...t.toJSON(),
      hotel_name: hotelMap[t.hotel_id] || null,
      creator_name: userMap[t.created_by] || null
    }));

    res.json({ success: true, transactions: enriched });
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /linen/transactions
router.post('/transactions', requireAuth, requirePermission('linen.manage'), async (req, res) => {
  try {
    const { hotel_id, transaction_type, transaction_date, petit_draps, petite_housse, grand_draps, grande_housse, notes, document_url } = req.body;
    if (!hotel_id || !transaction_type || !transaction_date) {
      return res.status(400).json({ success: false, message: 'hotel_id, transaction_type et transaction_date sont requis' });
    }

    const transaction = await LinenTransaction.create({
      hotel_id, transaction_type, transaction_date,
      petit_draps: petit_draps || 0, petite_housse: petite_housse || 0,
      grand_draps: grand_draps || 0, grande_housse: grande_housse || 0,
      notes: notes || null, document_url: document_url || null,
      created_by: req.user.id
    });

    res.status(201).json({ success: true, message: 'Transaction creee', transaction });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
