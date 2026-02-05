/**
 * ACL GESTION v2 - Closures Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Hotel, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// GET /closures/daily
router.get('/daily', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT dc.*, h.name AS hotel_name, su.first_name AS submitter_first_name, su.last_name AS submitter_last_name, vu.first_name AS validator_first_name, vu.last_name AS validator_last_name FROM daily_closures dc LEFT JOIN hotels h ON h.id = dc.hotel_id LEFT JOIN users su ON su.id = dc.submitted_by LEFT JOIN users vu ON vu.id = dc.validated_by WHERE 1=1';
    const params = {};

    if (req.query.hotel_id) { sql += ' AND dc.hotel_id = :hotel_id'; params.hotel_id = parseInt(req.query.hotel_id, 10); }
    else if (req.user.role !== 'admin' && req.user.role !== 'comptabilite') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) { sql += ' AND dc.hotel_id IN (:hotelIds)'; params.hotelIds = hotelIds; }
      else { return res.json({ success: true, closures: [] }); }
    }

    if (req.query.date_from) { sql += ' AND dc.closure_date >= :date_from'; params.date_from = req.query.date_from; }
    if (req.query.date_to) { sql += ' AND dc.closure_date <= :date_to'; params.date_to = req.query.date_to; }
    if (req.query.status) { sql += ' AND dc.status = :status'; params.status = req.query.status; }
    sql += ' ORDER BY dc.closure_date DESC LIMIT 100';

    const closures = await query(sql, params);
    res.json({ success: true, closures });
  } catch (error) {
    console.error('List closures error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /closures/daily
router.post('/daily', requireAuth, requirePermission('closures.create'), async (req, res) => {
  try {
    const { hotel_id, closure_date, cash_received, cash_spent, notes, remise_banque } = req.body;
    if (!hotel_id || !closure_date) return res.status(400).json({ success: false, message: 'hotel_id et closure_date sont requis' });

    const existing = await query('SELECT * FROM daily_closures WHERE hotel_id = :hotel_id AND closure_date = :closure_date', { hotel_id, closure_date });
    const cashBalance = (parseFloat(cash_received) || 0) - (parseFloat(cash_spent) || 0);

    if (existing.length > 0) {
      await sequelize.query(
        "UPDATE daily_closures SET cash_received = :cash_received, cash_spent = :cash_spent, cash_balance = :cash_balance, notes = :notes, remise_banque = :remise_banque, submitted_by = :submitted_by, submitted_at = NOW(), status = 'submitted', updated_at = NOW() WHERE id = :id",
        { replacements: { id: existing[0].id, cash_received: cash_received || 0, cash_spent: cash_spent || 0, cash_balance: cashBalance, notes: notes || null, remise_banque: remise_banque || 0, submitted_by: req.user.id } }
      );
      const updated = await query('SELECT * FROM daily_closures WHERE id = :id', { id: existing[0].id });
      return res.json({ success: true, message: 'Cloture mise a jour', closure: updated[0] });
    }

    const [result] = await sequelize.query(
      "INSERT INTO daily_closures (hotel_id, closure_date, cash_received, cash_spent, cash_balance, notes, remise_banque, status, submitted_by, submitted_at, created_at, updated_at) VALUES (:hotel_id, :closure_date, :cash_received, :cash_spent, :cash_balance, :notes, :remise_banque, 'submitted', :submitted_by, NOW(), NOW(), NOW())",
      { replacements: { hotel_id, closure_date, cash_received: cash_received || 0, cash_spent: cash_spent || 0, cash_balance: cashBalance, notes: notes || null, remise_banque: remise_banque || 0, submitted_by: req.user.id } }
    );
    const closures = await query('SELECT * FROM daily_closures WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Cloture creee', closure: closures[0] });
  } catch (error) {
    console.error('Create closure error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /closures/daily/:id
router.get('/daily/:id', requireAuth, async (req, res) => {
  try {
    const closures = await query(
      'SELECT dc.*, h.name AS hotel_name, su.first_name AS submitter_first_name, su.last_name AS submitter_last_name, vu.first_name AS validator_first_name, vu.last_name AS validator_last_name FROM daily_closures dc LEFT JOIN hotels h ON h.id = dc.hotel_id LEFT JOIN users su ON su.id = dc.submitted_by LEFT JOIN users vu ON vu.id = dc.validated_by WHERE dc.id = :id',
      { id: req.params.id }
    );
    if (closures.length === 0) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });

    const documents = await query('SELECT cd.*, cc.document_name FROM closure_documents cd LEFT JOIN closure_config cc ON cc.id = cd.config_id WHERE cd.closure_id = :id', { id: req.params.id });
    const fieldValues = await query('SELECT cfv.*, ccf.field_name, ccf.field_type FROM closure_field_values cfv LEFT JOIN closure_config_fields ccf ON ccf.id = cfv.field_id WHERE cfv.closure_id = :id', { id: req.params.id });

    res.json({ success: true, closure: { ...closures[0], documents, field_values: fieldValues } });
  } catch (error) {
    console.error('Get closure error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /closures/daily/:id
router.put('/daily/:id', requireAuth, async (req, res) => {
  try {
    const closures = await query('SELECT * FROM daily_closures WHERE id = :id', { id: req.params.id });
    if (closures.length === 0) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });

    const allowedFields = ['cash_received', 'cash_spent', 'notes', 'remise_banque'];
    const sets = [];
    const params = { id: req.params.id };
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) { sets.push(field + ' = :' + field); params[field] = req.body[field]; }
    });

    const cashReceived = req.body.cash_received !== undefined ? parseFloat(req.body.cash_received) : parseFloat(closures[0].cash_received);
    const cashSpent = req.body.cash_spent !== undefined ? parseFloat(req.body.cash_spent) : parseFloat(closures[0].cash_spent);
    sets.push('cash_balance = :cash_balance');
    params.cash_balance = cashReceived - cashSpent;
    sets.push('updated_at = NOW()');

    await sequelize.query('UPDATE daily_closures SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });
    const updated = await query('SELECT * FROM daily_closures WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Cloture mise a jour', closure: updated[0] });
  } catch (error) {
    console.error('Update closure error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /closures/daily/:id/validate
router.put('/daily/:id/validate', requireAuth, requirePermission('closures.validate'), async (req, res) => {
  try {
    const closures = await query('SELECT * FROM daily_closures WHERE id = :id', { id: req.params.id });
    if (closures.length === 0) return res.status(404).json({ success: false, message: 'Cloture non trouvee' });

    await sequelize.query("UPDATE daily_closures SET status = 'validated', validated_by = :validatedBy, validated_at = NOW(), updated_at = NOW() WHERE id = :id", { replacements: { id: req.params.id, validatedBy: req.user.id } });
    const updated = await query('SELECT * FROM daily_closures WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Cloture validee', closure: updated[0] });
  } catch (error) {
    console.error('Validate closure error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /closures/monthly
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT mc.*, h.name AS hotel_name FROM monthly_closures mc LEFT JOIN hotels h ON h.id = mc.hotel_id WHERE 1=1';
    const params = {};
    if (req.query.hotel_id) { sql += ' AND mc.hotel_id = :hotel_id'; params.hotel_id = parseInt(req.query.hotel_id, 10); }
    if (req.query.year) { sql += ' AND YEAR(mc.closure_month) = :year'; params.year = parseInt(req.query.year, 10); }
    sql += ' ORDER BY mc.closure_month DESC';

    const monthlies = await query(sql, params);
    res.json({ success: true, monthlies });
  } catch (error) {
    console.error('Monthly closures error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /closures/config/:hotelId
router.get('/config/:hotelId', requireAuth, async (req, res) => {
  try {
    const configs = await query('SELECT cc.*, (SELECT COUNT(*) FROM closure_config_fields ccf WHERE ccf.config_id = cc.id) AS fields_count FROM closure_config cc WHERE cc.hotel_id = :hotelId AND cc.is_active = 1 ORDER BY cc.sort_order ASC', { hotelId: req.params.hotelId });
    for (const config of configs) {
      config.fields = await query('SELECT * FROM closure_config_fields WHERE config_id = :configId ORDER BY sort_order ASC', { configId: config.id });
    }
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Get closure config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /closures/config
router.post('/config', requireAuth, async (req, res) => {
  try {
    const { hotel_id, closure_type, document_name, is_required, sort_order } = req.body;
    if (!hotel_id || !document_name) return res.status(400).json({ success: false, message: 'hotel_id et document_name sont requis' });

    const [result] = await sequelize.query(
      "INSERT INTO closure_config (hotel_id, closure_type, document_name, is_required, sort_order, is_active, created_at) VALUES (:hotel_id, :closure_type, :document_name, :is_required, :sort_order, 1, NOW())",
      { replacements: { hotel_id, closure_type: closure_type || 'daily', document_name, is_required: is_required !== undefined ? is_required : 1, sort_order: sort_order || 0 } }
    );
    const configs = await query('SELECT * FROM closure_config WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Configuration creee', config: configs[0] });
  } catch (error) {
    console.error('Create closure config error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /closures/alerts
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT ca.*, h.name AS hotel_name FROM closure_alerts ca LEFT JOIN hotels h ON h.id = ca.hotel_id WHERE 1=1';
    const params = {};
    if (req.user.role !== 'admin' && req.user.role !== 'comptabilite') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) { sql += ' AND ca.hotel_id IN (:hotelIds)'; params.hotelIds = hotelIds; }
      else { return res.json({ success: true, alerts: [] }); }
    }
    sql += ' ORDER BY ca.closure_date DESC LIMIT 50';
    const alerts = await query(sql, params);
    res.json({ success: true, alerts });
  } catch (error) {
    console.error('Closure alerts error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
