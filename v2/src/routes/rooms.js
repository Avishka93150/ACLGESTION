/**
 * ACL GESTION v2 - Rooms Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { Room, Hotel, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /rooms - List all rooms (filtered by user hotel access)
router.get('/', requireAuth, async (req, res) => {
  try {
    let hotelIds;

    if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({
        where: { user_id: req.user.id }
      });
      hotelIds = userHotels.map(uh => uh.hotel_id);
    }

    const where = {};
    if (hotelIds) {
      where.hotel_id = { [Op.in]: hotelIds };
    }
    if (req.query.hotel_id) {
      where.hotel_id = parseInt(req.query.hotel_id, 10);
    }

    const rooms = await Room.findAll({
      where,
      order: [['hotel_id', 'ASC'], ['room_number', 'ASC']]
    });

    res.json({ success: true, rooms });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /rooms - Create room
router.post('/', requireAuth, requirePermission('rooms.manage'), async (req, res) => {
  try {
    const { hotel_id, room_number, floor, room_type, bed_type, status } = req.body;

    if (!hotel_id || !room_number) {
      return res.status(400).json({
        success: false,
        message: 'hotel_id et room_number sont requis'
      });
    }

    const hotel = await Hotel.findByPk(hotel_id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel non trouve' });
    }

    // Check for duplicate room number in same hotel
    const existing = await Room.findOne({
      where: { hotel_id, room_number }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ce numero de chambre existe deja dans cet hotel'
      });
    }

    const room = await Room.create({
      hotel_id,
      room_number,
      floor: floor || 1,
      room_type: room_type || 'standard',
      bed_type: bed_type || 'double',
      status: status || 'active'
    });

    res.status(201).json({ success: true, message: 'Chambre creee', room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /rooms/:id - Get room details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvee' });
    }

    const hotel = await Hotel.findByPk(room.hotel_id, {
      attributes: ['id', 'name']
    });

    res.json({
      success: true,
      room: { ...room.toJSON(), hotel }
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /rooms/:id - Update room
router.put('/:id', requireAuth, requirePermission('rooms.manage'), async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvee' });
    }

    const allowedFields = ['room_number', 'floor', 'room_type', 'bed_type', 'status'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await room.update(updates);

    res.json({ success: true, message: 'Chambre mise a jour', room });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /rooms/:id - Delete room
router.delete('/:id', requireAuth, requirePermission('rooms.manage'), async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvee' });
    }

    await room.destroy();

    res.json({ success: true, message: 'Chambre supprimee' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
