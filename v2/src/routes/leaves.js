/**
 * ACL GESTION v2 - Leave Requests Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, UserHotel, Hotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { sendEmail, leaveNotificationHTML } = require('../services/email');
const config = require('../config');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// GET /leaves - List leave requests
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT lr.*, u.first_name, u.last_name, u.email AS employee_email, h.name AS hotel_name, v.first_name AS validator_first_name, v.last_name AS validator_last_name FROM leave_requests lr LEFT JOIN users u ON u.id = lr.employee_id LEFT JOIN hotels h ON h.id = lr.hotel_id LEFT JOIN users v ON v.id = lr.validated_by WHERE 1=1';
    const params = {};

    if (req.query.hotel_id) {
      sql += ' AND lr.hotel_id = :hotel_id';
      params.hotel_id = parseInt(req.query.hotel_id, 10);
    } else if (req.user.role !== 'admin' && req.user.role !== 'rh') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (['groupe_manager', 'hotel_manager'].includes(req.user.role) && hotelIds.length > 0) {
        sql += ' AND (lr.hotel_id IN (:hotelIds) OR lr.employee_id = :userId)';
        params.hotelIds = hotelIds;
        params.userId = req.user.id;
      } else {
        sql += ' AND lr.employee_id = :userId';
        params.userId = req.user.id;
      }
    }

    if (req.query.status) { sql += ' AND lr.status = :status'; params.status = req.query.status; }
    if (req.query.employee_id) { sql += ' AND lr.employee_id = :employee_id'; params.employee_id = parseInt(req.query.employee_id, 10); }
    sql += ' ORDER BY lr.created_at DESC LIMIT 200';

    const leaves = await query(sql, params);
    res.json({ success: true, leaves });
  } catch (error) {
    console.error('List leaves error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /leaves - Create leave request
router.post('/', requireAuth, requirePermission('leaves.create'), async (req, res) => {
  try {
    const { start_date, end_date, days_count, leave_type, comment, hotel_id } = req.body;
    if (!start_date || !end_date || !days_count) {
      return res.status(400).json({ success: false, message: 'start_date, end_date et days_count sont requis' });
    }

    let resolvedHotelId = hotel_id;
    if (!resolvedHotelId) {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      if (userHotels.length > 0) resolvedHotelId = userHotels[0].hotel_id;
    }

    const startMonth = new Date(start_date).getMonth() + 1;
    const quarter = 'Q' + Math.ceil(startMonth / 3);
    const year = new Date(start_date).getFullYear();

    const [result] = await sequelize.query(
      "INSERT INTO leave_requests (employee_id, start_date, end_date, days_count, leave_type, comment, status, quarter, year, hotel_id, is_manual, created_by, created_at, updated_at) VALUES (:employee_id, :start_date, :end_date, :days_count, :leave_type, :comment, 'pending', :quarter, :year, :hotel_id, 0, :created_by, NOW(), NOW())",
      { replacements: { employee_id: req.user.id, start_date, end_date, days_count, leave_type: leave_type || 'cp', comment: comment || null, quarter, year, hotel_id: resolvedHotelId || null, created_by: req.user.id } }
    );

    await sequelize.query(
      'INSERT INTO leave_balance (employee_id, year, pending_days, updated_at) VALUES (:employee_id, :year, :days, NOW()) ON DUPLICATE KEY UPDATE pending_days = pending_days + :days, updated_at = NOW()',
      { replacements: { employee_id: req.user.id, year, days: days_count } }
    );

    const leaves = await query('SELECT * FROM leave_requests WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Demande de conge creee', leave: leaves[0] });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /leaves/pending
router.get('/pending', requireAuth, async (req, res) => {
  try {
    let sql = "SELECT lr.*, u.first_name, u.last_name, h.name AS hotel_name FROM leave_requests lr LEFT JOIN users u ON u.id = lr.employee_id LEFT JOIN hotels h ON h.id = lr.hotel_id WHERE lr.status = 'pending'";
    const params = {};

    if (req.user.role !== 'admin' && req.user.role !== 'rh') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) { sql += ' AND lr.hotel_id IN (:hotelIds)'; params.hotelIds = hotelIds; }
      else { return res.json({ success: true, leaves: [] }); }
    }

    sql += ' ORDER BY lr.start_date ASC';
    const leaves = await query(sql, params);
    res.json({ success: true, leaves });
  } catch (error) {
    console.error('Pending leaves error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /leaves/balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const employeeId = req.query.employee_id ? parseInt(req.query.employee_id, 10) : req.user.id;
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

    const balance = await query('SELECT * FROM leave_balance WHERE employee_id = :employeeId AND year = :year', { employeeId, year });
    if (balance.length === 0) {
      return res.json({ success: true, balance: { employee_id: employeeId, year, total_days: 25, used_days: 0, pending_days: 0, remaining_days: 25 } });
    }

    const b = balance[0];
    res.json({ success: true, balance: { ...b, remaining_days: b.total_days - b.used_days - b.pending_days } });
  } catch (error) {
    console.error('Leave balance error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /leaves/:id/approve
router.put('/:id/approve', requireAuth, requirePermission('leaves.validate'), async (req, res) => {
  try {
    const leaves = await query('SELECT * FROM leave_requests WHERE id = :id', { id: req.params.id });
    if (leaves.length === 0) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (leaves[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Cette demande a deja ete traitee' });

    const { approval_comment } = req.body;
    await sequelize.query(
      "UPDATE leave_requests SET status = 'approved', validated_by = :validatedBy, validated_at = NOW(), approval_comment = :approval_comment, updated_at = NOW() WHERE id = :id",
      { replacements: { id: req.params.id, validatedBy: req.user.id, approval_comment: approval_comment || null } }
    );

    const year = leaves[0].year || new Date(leaves[0].start_date).getFullYear();
    await sequelize.query(
      'UPDATE leave_balance SET used_days = used_days + :days, pending_days = GREATEST(pending_days - :days, 0), updated_at = NOW() WHERE employee_id = :employee_id AND year = :year',
      { replacements: { employee_id: leaves[0].employee_id, year, days: leaves[0].days_count } }
    );

    const updated = await query('SELECT * FROM leave_requests WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Demande approuvee', leave: updated[0] });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /leaves/:id/reject
router.put('/:id/reject', requireAuth, requirePermission('leaves.validate'), async (req, res) => {
  try {
    const leaves = await query('SELECT * FROM leave_requests WHERE id = :id', { id: req.params.id });
    if (leaves.length === 0) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (leaves[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Cette demande a deja ete traitee' });

    const { rejection_reason } = req.body;
    await sequelize.query(
      "UPDATE leave_requests SET status = 'rejected', validated_by = :validatedBy, validated_at = NOW(), rejection_reason = :rejection_reason, updated_at = NOW() WHERE id = :id",
      { replacements: { id: req.params.id, validatedBy: req.user.id, rejection_reason: rejection_reason || null } }
    );

    const year = leaves[0].year || new Date(leaves[0].start_date).getFullYear();
    await sequelize.query(
      'UPDATE leave_balance SET pending_days = GREATEST(pending_days - :days, 0), updated_at = NOW() WHERE employee_id = :employee_id AND year = :year',
      { replacements: { employee_id: leaves[0].employee_id, year, days: leaves[0].days_count } }
    );

    const updated = await query('SELECT * FROM leave_requests WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Demande rejetee', leave: updated[0] });
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /leaves/report
router.get('/report', requireAuth, async (req, res) => {
  try {
    const params = {};
    let hotelFilter = '';
    if (req.query.hotel_id) { hotelFilter = ' AND lr.hotel_id = :hotel_id'; params.hotel_id = parseInt(req.query.hotel_id, 10); }

    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    params.year = year;

    const byType = await query("SELECT leave_type, COUNT(*) as count, SUM(days_count) as total_days FROM leave_requests lr WHERE lr.year = :year AND lr.status = 'approved'" + hotelFilter + ' GROUP BY leave_type', params);
    const byMonth = await query("SELECT MONTH(start_date) as month, COUNT(*) as count, SUM(days_count) as total_days FROM leave_requests lr WHERE lr.year = :year AND lr.status = 'approved'" + hotelFilter + ' GROUP BY MONTH(start_date) ORDER BY month', params);
    const totalPending = await query("SELECT COUNT(*) as count FROM leave_requests lr WHERE lr.status = 'pending'" + hotelFilter, params);

    res.json({ success: true, report: { year, byType, byMonth, pendingCount: totalPending[0].count } });
  } catch (error) {
    console.error('Leave report error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /leaves/for-other
router.post('/for-other', requireAuth, requirePermission('leaves.manage_all'), async (req, res) => {
  try {
    const { employee_id, start_date, end_date, days_count, leave_type, comment, hotel_id } = req.body;
    if (!employee_id || !start_date || !end_date || !days_count) {
      return res.status(400).json({ success: false, message: 'employee_id, start_date, end_date et days_count sont requis' });
    }

    const employee = await User.findByPk(employee_id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employe non trouve' });

    const startMonth = new Date(start_date).getMonth() + 1;
    const quarter = 'Q' + Math.ceil(startMonth / 3);
    const year = new Date(start_date).getFullYear();

    const [result] = await sequelize.query(
      "INSERT INTO leave_requests (employee_id, start_date, end_date, days_count, leave_type, comment, status, quarter, year, hotel_id, is_manual, created_by, created_at, updated_at) VALUES (:employee_id, :start_date, :end_date, :days_count, :leave_type, :comment, 'pending', :quarter, :year, :hotel_id, 1, :created_by, NOW(), NOW())",
      { replacements: { employee_id, start_date, end_date, days_count, leave_type: leave_type || 'cp', comment: comment || null, quarter, year, hotel_id: hotel_id || null, created_by: req.user.id } }
    );

    await sequelize.query(
      'INSERT INTO leave_balance (employee_id, year, pending_days, updated_at) VALUES (:employee_id, :year, :days, NOW()) ON DUPLICATE KEY UPDATE pending_days = pending_days + :days, updated_at = NOW()',
      { replacements: { employee_id, year, days: days_count } }
    );

    const leaves = await query('SELECT * FROM leave_requests WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Demande creee pour employe', leave: leaves[0] });
  } catch (error) {
    console.error('Create leave for other error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
