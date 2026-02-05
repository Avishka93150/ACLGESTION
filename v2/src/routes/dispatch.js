/**
 * ACL GESTION v2 - Dispatch Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { RoomDispatch, Room, Hotel, User, UserHotel, DispatchAlert } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// GET /dispatch - List dispatches
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = {};

    // Filter by hotel access
    if (req.query.hotel_id) {
      // Need to find rooms in this hotel
      const rooms = await Room.findAll({
        where: { hotel_id: parseInt(req.query.hotel_id, 10) },
        attributes: ['id']
      });
      where.room_id = { [Op.in]: rooms.map(r => r.id) };
    } else if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) {
        const rooms = await Room.findAll({
          where: { hotel_id: { [Op.in]: hotelIds } },
          attributes: ['id']
        });
        where.room_id = { [Op.in]: rooms.map(r => r.id) };
      }
    }

    if (req.query.date) where.dispatch_date = req.query.date;
    if (req.query.status) where.status = req.query.status;

    const dispatches = await RoomDispatch.findAll({
      where,
      order: [['dispatch_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 200
    });

    // Enrich with room info and assignee name
    const roomIds = [...new Set(dispatches.map(d => d.room_id))];
    const assigneeIds = [...new Set(dispatches.filter(d => d.assigned_to).map(d => d.assigned_to))];

    const rooms = roomIds.length > 0
      ? await Room.findAll({ where: { id: { [Op.in]: roomIds } }, attributes: ['id', 'hotel_id', 'room_number', 'floor', 'room_type'] })
      : [];
    const roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r.toJSON(); });

    // Get hotel names for rooms
    const roomHotelIds = [...new Set(rooms.map(r => r.hotel_id))];
    const hotels = roomHotelIds.length > 0
      ? await Hotel.findAll({ where: { id: { [Op.in]: roomHotelIds } }, attributes: ['id', 'name'] })
      : [];
    const hotelMap = {};
    hotels.forEach(h => { hotelMap[h.id] = h.name; });

    const users = assigneeIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: assigneeIds } }, attributes: ['id', 'first_name', 'last_name'] })
      : [];
    const userMap = {};
    users.forEach(u => { userMap[u.id] = `${u.first_name} ${u.last_name}`; });

    const enriched = dispatches.map(d => {
      const room = roomMap[d.room_id] || {};
      return {
        ...d.toJSON(),
        room_number: room.room_number || null,
        floor: room.floor || null,
        room_type: room.room_type || null,
        hotel_id: room.hotel_id || null,
        hotel_name: room.hotel_id ? hotelMap[room.hotel_id] || null : null,
        assignee_name: d.assigned_to ? userMap[d.assigned_to] || null : null
      };
    });

    res.json({ success: true, dispatches: enriched });
  } catch (error) {
    console.error('List dispatches error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /dispatch - Create dispatch
router.post('/', requireAuth, requirePermission('dispatch.create'), async (req, res) => {
  try {
    const { room_id, dispatch_date, cleaning_type, assigned_to, priority } = req.body;

    if (!room_id || !dispatch_date || !cleaning_type) {
      return res.status(400).json({
        success: false,
        message: 'room_id, dispatch_date et cleaning_type sont requis'
      });
    }

    const room = await Room.findByPk(room_id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chambre non trouvee' });
    }

    // Check for existing dispatch for this room/date
    const existing = await RoomDispatch.findOne({
      where: { room_id, dispatch_date }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Un dispatch existe deja pour cette chambre a cette date'
      });
    }

    const dispatch = await RoomDispatch.create({
      room_id,
      dispatch_date,
      cleaning_type,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
      priority: priority || 'normal',
      status: 'pending'
    });

    res.status(201).json({ success: true, message: 'Dispatch cree', dispatch });
  } catch (error) {
    console.error('Create dispatch error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /dispatch/:id - Update dispatch
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const dispatch = await RoomDispatch.findByPk(req.params.id);
    if (!dispatch) {
      return res.status(404).json({ success: false, message: 'Dispatch non trouve' });
    }

    const allowedFields = ['cleaning_type', 'assigned_to', 'priority', 'status'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await dispatch.update(updates);

    res.json({ success: true, message: 'Dispatch mis a jour', dispatch });
  } catch (error) {
    console.error('Update dispatch error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /dispatch/:id/complete - Mark dispatch as completed
router.put('/:id/complete', requireAuth, requirePermission('dispatch.complete'), async (req, res) => {
  try {
    const dispatch = await RoomDispatch.findByPk(req.params.id);
    if (!dispatch) {
      return res.status(404).json({ success: false, message: 'Dispatch non trouve' });
    }

    await dispatch.update({
      status: 'completed',
      completed_at: new Date(),
      completed_by: req.user.id
    });

    res.json({ success: true, message: 'Dispatch marque comme termine', dispatch });
  } catch (error) {
    console.error('Complete dispatch error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /dispatch/:id/control - Submit QA control
router.put('/:id/control', requireAuth, requirePermission('dispatch.control'), async (req, res) => {
  try {
    const dispatch = await RoomDispatch.findByPk(req.params.id);
    if (!dispatch) {
      return res.status(404).json({ success: false, message: 'Dispatch non trouve' });
    }

    const {
      control_status, control_notes, control_photos,
      ctrl_literie, ctrl_salle_bain, ctrl_sol_surfaces,
      ctrl_equipements, ctrl_ambiance, ctrl_proprete
    } = req.body;

    const updates = {
      status: 'controlled',
      controlled_at: new Date(),
      controlled_by: req.user.id,
      control_status: control_status || 'ok',
      control_notes: control_notes || null,
      control_photos: control_photos ? JSON.stringify(control_photos) : null
    };

    // Checklist fields
    if (ctrl_literie !== undefined) updates.ctrl_literie = ctrl_literie;
    if (ctrl_salle_bain !== undefined) updates.ctrl_salle_bain = ctrl_salle_bain;
    if (ctrl_sol_surfaces !== undefined) updates.ctrl_sol_surfaces = ctrl_sol_surfaces;
    if (ctrl_equipements !== undefined) updates.ctrl_equipements = ctrl_equipements;
    if (ctrl_ambiance !== undefined) updates.ctrl_ambiance = ctrl_ambiance;
    if (ctrl_proprete !== undefined) updates.ctrl_proprete = ctrl_proprete;

    await dispatch.update(updates);

    res.json({ success: true, message: 'Controle enregistre', dispatch });
  } catch (error) {
    console.error('Control dispatch error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /dispatch/alerts - List dispatch alerts
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    const where = {};

    if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      where.hotel_id = { [Op.in]: hotelIds };
    }
    if (req.query.hotel_id) {
      where.hotel_id = parseInt(req.query.hotel_id, 10);
    }

    const alerts = await DispatchAlert.findAll({
      where,
      order: [['alert_date', 'DESC']],
      limit: 50
    });

    // Enrich with hotel names
    const hotelIds = [...new Set(alerts.map(a => a.hotel_id))];
    const hotels = hotelIds.length > 0
      ? await Hotel.findAll({ where: { id: { [Op.in]: hotelIds } }, attributes: ['id', 'name'] })
      : [];
    const hotelMap = {};
    hotels.forEach(h => { hotelMap[h.id] = h.name; });

    const enriched = alerts.map(a => ({
      ...a.toJSON(),
      hotel_name: hotelMap[a.hotel_id] || null
    }));

    res.json({ success: true, alerts: enriched });
  } catch (error) {
    console.error('List alerts error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /dispatch/:id - Delete dispatch
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const dispatch = await RoomDispatch.findByPk(req.params.id);
    if (!dispatch) {
      return res.status(404).json({ success: false, message: 'Dispatch non trouve' });
    }

    await dispatch.destroy();

    res.json({ success: true, message: 'Dispatch supprime' });
  } catch (error) {
    console.error('Delete dispatch error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
