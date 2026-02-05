const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const {
      Hotel, Room, MaintenanceTicket, RoomDispatch, LeaveRequest,
      Task, Notification, ConversationMessage, Conversation, UserHotel
    } = require('../models');

    const today = new Date().toISOString().split('T')[0];

    // Hotels accessibles par l'utilisateur
    let hotelFilter = {};
    if (!['admin', 'groupe_manager'].includes(req.user.role)) {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      hotelFilter = { id: hotelIds };
    }

    const hotels = await Hotel.count({ where: { status: 'active', ...hotelFilter } });
    const rooms = await Room.count({
      include: [{ model: Hotel, where: { status: 'active', ...hotelFilter }, attributes: [] }]
    });

    // Maintenance
    const openTickets = await MaintenanceTicket.count({ where: { status: 'open' } });
    const inProgressTickets = await MaintenanceTicket.count({ where: { status: 'in_progress' } });
    const criticalTickets = await MaintenanceTicket.count({ where: { status: { [Op.ne]: 'resolved' }, priority: 'critical' } });

    // Dispatch du jour
    const todayDispatch = await RoomDispatch.count({
      include: [{ model: Room, include: [{ model: Hotel, where: hotelFilter, attributes: [] }] }],
      where: { dispatch_date: today }
    });
    const todayControlled = await RoomDispatch.count({
      include: [{ model: Room, include: [{ model: Hotel, where: hotelFilter, attributes: [] }] }],
      where: { dispatch_date: today, status: 'controlled' }
    });

    // Conges en attente
    const pendingLeaves = await LeaveRequest.count({ where: { status: 'pending' } });

    // Taches en retard
    const overdueTasks = await Task.count({
      where: { due_date: { [Op.lt]: today }, is_completed: 0, is_archived: 0 }
    });

    // Notifications non lues
    const unreadNotifications = await Notification.count({ where: { user_id: req.user.id, is_read: 0 } });

    // Messages non lus
    const convs = await Conversation.findAll({
      where: { [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }] },
      attributes: ['id']
    });
    const convIds = convs.map(c => c.id);
    const unreadMessages = convIds.length > 0 ? await ConversationMessage.count({
      where: { conversation_id: convIds, sender_id: { [Op.ne]: req.user.id }, is_read: 0 }
    }) : 0;

    res.json({
      success: true,
      stats: {
        hotels, rooms, openTickets, inProgressTickets, criticalTickets,
        todayDispatch, todayControlled, pendingLeaves, overdueTasks,
        unreadNotifications, unreadMessages,
        dispatchCompletion: todayDispatch > 0 ? Math.round((todayControlled / todayDispatch) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
