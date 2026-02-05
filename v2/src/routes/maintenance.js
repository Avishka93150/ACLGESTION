/**
 * ACL GESTION v2 - Maintenance Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { MaintenanceTicket, TicketComment, Hotel, User, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { uploadPhoto } = require('../middleware/upload');

// GET /maintenance/stats - Ticket statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    let hotelFilter = {};
    if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      hotelFilter.hotel_id = { [Op.in]: hotelIds };
    }
    if (req.query.hotel_id) {
      hotelFilter.hotel_id = parseInt(req.query.hotel_id, 10);
    }

    const byStatus = {
      open: await MaintenanceTicket.count({ where: { ...hotelFilter, status: 'open' } }),
      in_progress: await MaintenanceTicket.count({ where: { ...hotelFilter, status: 'in_progress' } }),
      resolved: await MaintenanceTicket.count({ where: { ...hotelFilter, status: 'resolved' } })
    };

    const byPriority = {
      low: await MaintenanceTicket.count({ where: { ...hotelFilter, priority: 'low', status: { [Op.ne]: 'resolved' } } }),
      medium: await MaintenanceTicket.count({ where: { ...hotelFilter, priority: 'medium', status: { [Op.ne]: 'resolved' } } }),
      high: await MaintenanceTicket.count({ where: { ...hotelFilter, priority: 'high', status: { [Op.ne]: 'resolved' } } }),
      critical: await MaintenanceTicket.count({ where: { ...hotelFilter, priority: 'critical', status: { [Op.ne]: 'resolved' } } })
    };

    const total = await MaintenanceTicket.count({ where: hotelFilter });

    res.json({ success: true, stats: { total, byStatus, byPriority } });
  } catch (error) {
    console.error('Maintenance stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /maintenance - List tickets
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = {};

    if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      where.hotel_id = { [Op.in]: hotelIds };
    }

    if (req.query.hotel_id) where.hotel_id = parseInt(req.query.hotel_id, 10);
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;

    const tickets = await MaintenanceTicket.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 100
    });

    // Enrich with hotel names and user names
    const hotelIds = [...new Set(tickets.map(t => t.hotel_id))];
    const userIds = [...new Set([
      ...tickets.map(t => t.reported_by),
      ...tickets.filter(t => t.assigned_to).map(t => t.assigned_to)
    ])];

    const hotels = hotelIds.length > 0 ? await Hotel.findAll({ where: { id: { [Op.in]: hotelIds } }, attributes: ['id', 'name'] }) : [];
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'first_name', 'last_name'] }) : [];

    const hotelMap = {};
    hotels.forEach(h => { hotelMap[h.id] = h.name; });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = `${u.first_name} ${u.last_name}`; });

    const enriched = tickets.map(t => ({
      ...t.toJSON(),
      hotel_name: hotelMap[t.hotel_id] || null,
      reporter_name: userMap[t.reported_by] || null,
      assignee_name: t.assigned_to ? userMap[t.assigned_to] || null : null
    }));

    res.json({ success: true, tickets: enriched });
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /maintenance - Create ticket
router.post('/', requireAuth, requirePermission('maintenance.create'), async (req, res) => {
  try {
    const { hotel_id, room_number, category, description, priority, photo, room_blocked } = req.body;

    if (!hotel_id || !category || !description) {
      return res.status(400).json({
        success: false,
        message: 'hotel_id, category et description sont requis'
      });
    }

    const ticket = await MaintenanceTicket.create({
      hotel_id,
      room_number: room_number || null,
      category,
      description,
      priority: priority || 'medium',
      photo: photo || null,
      reported_by: req.user.id,
      status: 'open',
      room_blocked: room_blocked || 0
    });

    res.status(201).json({ success: true, message: 'Ticket cree', ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /maintenance/:id - Get ticket details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouve' });
    }

    // Get hotel name
    const hotel = await Hotel.findByPk(ticket.hotel_id, { attributes: ['id', 'name'] });

    // Get reporter and assignee names
    const reporter = await User.findByPk(ticket.reported_by, { attributes: ['id', 'first_name', 'last_name'] });
    let assignee = null;
    if (ticket.assigned_to) {
      assignee = await User.findByPk(ticket.assigned_to, { attributes: ['id', 'first_name', 'last_name'] });
    }

    // Get comments
    const comments = await TicketComment.findAll({
      where: { ticket_id: ticket.id },
      order: [['created_at', 'ASC']]
    });

    // Enrich comments with user names
    const commentUserIds = [...new Set(comments.map(c => c.user_id))];
    const commentUsers = commentUserIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: commentUserIds } }, attributes: ['id', 'first_name', 'last_name'] })
      : [];
    const userMap = {};
    commentUsers.forEach(u => { userMap[u.id] = `${u.first_name} ${u.last_name}`; });

    const enrichedComments = comments.map(c => ({
      ...c.toJSON(),
      user_name: userMap[c.user_id] || null
    }));

    res.json({
      success: true,
      ticket: {
        ...ticket.toJSON(),
        hotel_name: hotel ? hotel.name : null,
        reporter_name: reporter ? `${reporter.first_name} ${reporter.last_name}` : null,
        assignee_name: assignee ? `${assignee.first_name} ${assignee.last_name}` : null,
        comments: enrichedComments
      }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /maintenance/:id - Update ticket
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouve' });
    }

    const updates = {};
    const allowedFields = ['status', 'priority', 'assigned_to', 'resolution_notes', 'room_blocked', 'category', 'description'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Handle status-specific logic
    if (updates.status === 'in_progress' && !ticket.assigned_to && !updates.assigned_to) {
      updates.assigned_to = req.user.id;
      updates.assigned_at = new Date();
    }

    if (updates.assigned_to && !ticket.assigned_at) {
      updates.assigned_at = new Date();
    }

    if (updates.status === 'resolved') {
      updates.resolved_by = req.user.id;
      updates.resolved_at = new Date();
    }

    await ticket.update(updates);

    res.json({ success: true, message: 'Ticket mis a jour', ticket });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /maintenance/:id/comments - Add comment
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouve' });
    }

    const { content, status_change } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Le contenu est requis' });
    }

    const comment = await TicketComment.create({
      ticket_id: ticket.id,
      user_id: req.user.id,
      content,
      status_change: status_change || null
    });

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'first_name', 'last_name'] });

    res.status(201).json({
      success: true,
      message: 'Commentaire ajoute',
      comment: {
        ...comment.toJSON(),
        user_name: user ? `${user.first_name} ${user.last_name}` : null
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /maintenance/:id/photos - Upload photo
router.post('/:id/photos', requireAuth, uploadPhoto('maintenance'), async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouve' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier envoye' });
    }

    const photoUrl = `/uploads/maintenance/${req.file.filename}`;
    await ticket.update({ photo: photoUrl });

    res.json({ success: true, message: 'Photo ajoutee', photo: photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
