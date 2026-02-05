const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const bcrypt = require('bcryptjs');

router.get('/', requireAuth, requirePermission('users.view'), async (req, res) => {
  try {
    const { User, Hotel, UserHotel } = require('../models');
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.status) where.status = req.query.status;
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{ model: Hotel, through: { model: UserHotel, attributes: [] }, attributes: ['id', 'name'] }],
      order: [['last_name', 'ASC'], ['first_name', 'ASC']]
    });
    // Filtrer par hotel si specifie
    let result = users;
    if (req.query.hotel_id) {
      result = users.filter(u => u.hotels && u.hotels.some(h => h.id === parseInt(req.query.hotel_id)));
    }
    res.json({ success: true, users: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const { User } = require('../models');
    const { email, password, first_name, last_name, phone, role } = req.body;
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: 'Email deja utilise' });
    const user = await User.create({
      email, password: await bcrypt.hash(password, 10),
      first_name, last_name, phone: phone || null,
      role, status: 'active', is_active: 1
    });
    const { password: _, ...userData } = user.toJSON();
    res.status(201).json({ success: true, user: userData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { User, Hotel, UserHotel } = require('../models');
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Hotel, through: { model: UserHotel, attributes: [] } }]
    });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });
    const updates = { ...req.body };
    if (updates.password) updates.password = await bcrypt.hash(updates.password, 10);
    else delete updates.password;
    await user.update(updates);
    const { password: _, ...userData } = user.toJSON();
    res.json({ success: true, user: userData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const { User } = require('../models');
    await User.update({ status: 'inactive', is_active: 0 }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/hotels', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const { UserHotel } = require('../models');
    const userId = req.params.id;
    const { hotel_ids } = req.body;
    await UserHotel.destroy({ where: { user_id: userId } });
    if (hotel_ids && hotel_ids.length > 0) {
      await UserHotel.bulkCreate(hotel_ids.map(hid => ({ user_id: userId, hotel_id: hid })));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
