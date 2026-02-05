/**
 * ACL GESTION v2 - Hotels Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { Hotel, Room, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /hotels - List hotels (filtered by user access)
router.get('/', requireAuth, async (req, res) => {
  try {
    let where = { status: 'active' };

    if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({
        where: { user_id: req.user.id }
      });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      where.id = { [Op.in]: hotelIds };
    }

    const hotels = await Hotel.findAll({ where, order: [['name', 'ASC']] });

    res.json({ success: true, hotels });
  } catch (error) {
    console.error('List hotels error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /hotels - Create hotel
router.post('/', requireAuth, requirePermission('hotels.create'), async (req, res) => {
  try {
    const { name, address, city, postal_code, phone, email, stars, total_floors, checkin_time, checkout_time, logo_url, xotelo_hotel_key } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const hotel = await Hotel.create({
      name, address, city, postal_code, phone, email,
      stars: stars || 3,
      total_floors: total_floors || 1,
      checkin_time: checkin_time || '15:00:00',
      checkout_time: checkout_time || '11:00:00',
      logo_url, xotelo_hotel_key,
      status: 'active'
    });

    res.status(201).json({ success: true, message: 'Hotel cree', hotel });
  } catch (error) {
    console.error('Create hotel error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /hotels/:id - Get hotel details with rooms count
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const hotel = await Hotel.findByPk(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel non trouve' });
    }

    const roomsCount = await Room.count({ where: { hotel_id: hotel.id } });

    res.json({
      success: true,
      hotel: { ...hotel.toJSON(), rooms_count: roomsCount }
    });
  } catch (error) {
    console.error('Get hotel error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /hotels/:id - Update hotel
router.put('/:id', requireAuth, requirePermission('hotels.edit'), async (req, res) => {
  try {
    const hotel = await Hotel.findByPk(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel non trouve' });
    }

    const allowedFields = ['name', 'address', 'city', 'postal_code', 'phone', 'email', 'stars', 'total_floors', 'checkin_time', 'checkout_time', 'logo_url', 'xotelo_hotel_key', 'status'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await hotel.update(updates);

    res.json({ success: true, message: 'Hotel mis a jour', hotel });
  } catch (error) {
    console.error('Update hotel error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /hotels/:id - Soft delete hotel
router.delete('/:id', requireAuth, requirePermission('hotels.delete'), async (req, res) => {
  try {
    const hotel = await Hotel.findByPk(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel non trouve' });
    }

    await hotel.update({ status: 'inactive' });

    res.json({ success: true, message: 'Hotel desactive' });
  } catch (error) {
    console.error('Delete hotel error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /hotels/:id/rooms - List rooms for hotel
router.get('/:id/rooms', requireAuth, async (req, res) => {
  try {
    const hotel = await Hotel.findByPk(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel non trouve' });
    }

    const rooms = await Room.findAll({
      where: { hotel_id: req.params.id },
      order: [['room_number', 'ASC']]
    });

    res.json({ success: true, rooms });
  } catch (error) {
    console.error('List hotel rooms error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
