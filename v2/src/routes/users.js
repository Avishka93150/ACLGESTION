/**
 * ACL GESTION v2 - Users Routes
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Hotel, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /users
router.get('/', requireAuth, requirePermission('users.view'), async (req, res) => {
  try {
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.status) where.status = req.query.status;

    let users;
    if (req.query.hotel_id) {
      const assignments = await UserHotel.findAll({ where: { hotel_id: parseInt(req.query.hotel_id, 10) } });
      const userIds = assignments.map(a => a.user_id);
      where.id = { [Op.in]: userIds };
    }

    users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['last_name', 'ASC'], ['first_name', 'ASC']]
    });

    // Get hotel assignments for each user
    const allUserIds = users.map(u => u.id);
    const allAssignments = allUserIds.length > 0
      ? await UserHotel.findAll({ where: { user_id: { [Op.in]: allUserIds } } })
      : [];
    const allHotelIds = [...new Set(allAssignments.map(a => a.hotel_id))];
    const hotels = allHotelIds.length > 0
      ? await Hotel.findAll({ where: { id: { [Op.in]: allHotelIds } }, attributes: ['id', 'name'] })
      : [];
    const hotelMap = {};
    hotels.forEach(h => { hotelMap[h.id] = h.name; });

    const enriched = users.map(u => {
      const userAssignments = allAssignments.filter(a => a.user_id === u.id);
      return {
        ...u.toJSON(),
        hotels: userAssignments.map(a => ({ id: a.hotel_id, name: hotelMap[a.hotel_id] || null }))
      };
    });

    res.json({ success: true, users: enriched });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /users
router.post('/', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role, status } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Email, mot de passe, prenom et nom sont requis' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ success: false, message: 'Cet email est deja utilise' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      first_name, last_name,
      phone: phone || null,
      role: role || 'employee',
      status: status || 'active'
    });

    const userData = user.toJSON();
    delete userData.password;
    res.status(201).json({ success: true, message: 'Utilisateur cree', user: userData });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /users/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });

    const assignments = await UserHotel.findAll({ where: { user_id: user.id } });
    const hotelIds = assignments.map(a => a.hotel_id);
    const hotels = hotelIds.length > 0
      ? await Hotel.findAll({ where: { id: { [Op.in]: hotelIds } }, attributes: ['id', 'name'] })
      : [];

    res.json({ success: true, user: { ...user.toJSON(), hotels } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /users/:id
router.put('/:id', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });

    const updates = {};
    const allowedFields = ['email', 'first_name', 'last_name', 'phone', 'role', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.email) updates.email = req.body.email.toLowerCase().trim();
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 10);

    await user.update(updates);
    const userData = user.toJSON();
    delete userData.password;
    res.json({ success: true, message: 'Utilisateur mis a jour', user: userData });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /users/:id - Deactivate user
router.delete('/:id', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });

    await user.update({ status: 'inactive' });
    res.json({ success: true, message: 'Utilisateur desactive' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /users/:id/hotels - Assign hotels
router.put('/:id/hotels', requireAuth, requirePermission('users.manage'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });

    const { hotel_ids } = req.body;
    if (!Array.isArray(hotel_ids)) return res.status(400).json({ success: false, message: 'hotel_ids doit etre un tableau' });

    // Remove existing assignments
    await UserHotel.destroy({ where: { user_id: user.id } });

    // Create new assignments
    for (const hotelId of hotel_ids) {
      await UserHotel.create({ user_id: user.id, hotel_id: hotelId });
    }

    const assignments = await UserHotel.findAll({ where: { user_id: user.id } });
    const hotelIds = assignments.map(a => a.hotel_id);
    const hotels = hotelIds.length > 0
      ? await Hotel.findAll({ where: { id: { [Op.in]: hotelIds } }, attributes: ['id', 'name'] })
      : [];

    res.json({ success: true, message: 'Hotels assignes', hotels });
  } catch (error) {
    console.error('Assign hotels error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
