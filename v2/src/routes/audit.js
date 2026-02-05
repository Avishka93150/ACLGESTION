const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { Op } = require('sequelize');

// ======================== GRIDS ========================
router.get('/grids', requireAuth, async (req, res) => {
  try {
    const { AuditGrid, AuditQuestion } = require('../models');
    const grids = await AuditGrid.findAll({
      where: { is_active: 1 },
      include: [{ model: AuditQuestion, attributes: ['id'] }],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, grids: grids.map(g => ({
      ...g.toJSON(), question_count: g.audit_questions ? g.audit_questions.length : 0
    }))});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grids', requireAuth, requirePermission('audit.grids'), async (req, res) => {
  try {
    const { AuditGrid } = require('../models');
    const grid = await AuditGrid.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grids/full', requireAuth, requirePermission('audit.grids'), async (req, res) => {
  try {
    const { AuditGrid, AuditQuestion, sequelize } = require('../models');
    const { grid: gridData, questions } = req.body;
    const result = await sequelize.transaction(async (t) => {
      const grid = await AuditGrid.create({ ...gridData, created_by: req.user.id }, { transaction: t });
      for (let i = 0; i < (questions || []).length; i++) {
        await AuditQuestion.create({ ...questions[i], grid_id: grid.id, position: i }, { transaction: t });
      }
      return grid;
    });
    res.status(201).json({ success: true, grid: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/grids/:id', requireAuth, async (req, res) => {
  try {
    const { AuditGrid, AuditQuestion } = require('../models');
    const grid = await AuditGrid.findByPk(req.params.id, {
      include: [{ model: AuditQuestion, order: [['position', 'ASC']] }]
    });
    if (!grid) return res.status(404).json({ success: false, message: 'Grille non trouvee' });
    res.json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/grids/:id', requireAuth, requirePermission('audit.grids'), async (req, res) => {
  try {
    const { AuditGrid } = require('../models');
    const grid = await AuditGrid.findByPk(req.params.id);
    if (!grid) return res.status(404).json({ success: false, message: 'Grille non trouvee' });
    await grid.update(req.body);
    res.json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/grids/:id', requireAuth, requirePermission('audit.grids'), async (req, res) => {
  try {
    const { AuditGrid } = require('../models');
    await AuditGrid.update({ is_active: 0 }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================== AUDITS ========================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { Audit, AuditGrid, User, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.status) where.status = req.query.status;
    const audits = await Audit.findAll({
      where,
      include: [
        { model: AuditGrid, attributes: ['id', 'name'] },
        { model: User, as: 'auditor', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, audits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('audit.execute'), async (req, res) => {
  try {
    const { Audit } = require('../models');
    const audit = await Audit.create({ ...req.body, auditor_id: req.user.id, status: 'planned' });
    res.status(201).json({ success: true, audit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { Audit } = require('../models');
    const total = await Audit.count();
    const planned = await Audit.count({ where: { status: 'planned' } });
    const inProgress = await Audit.count({ where: { status: 'in_progress' } });
    const completed = await Audit.count({ where: { status: 'completed' } });
    res.json({ success: true, stats: { total, planned, in_progress: inProgress, completed } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { Audit, AuditGrid, AuditQuestion, AuditAnswer, User, Hotel } = require('../models');
    const audit = await Audit.findByPk(req.params.id, {
      include: [
        { model: AuditGrid, include: [{ model: AuditQuestion, order: [['position', 'ASC']] }] },
        { model: AuditAnswer, include: [{ model: AuditQuestion }] },
        { model: User, as: 'auditor', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ]
    });
    if (!audit) return res.status(404).json({ success: false, message: 'Audit non trouve' });
    res.json({ success: true, audit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { Audit, AuditAnswer, sequelize } = require('../models');
    const audit = await Audit.findByPk(req.params.id);
    if (!audit) return res.status(404).json({ success: false, message: 'Audit non trouve' });
    await sequelize.transaction(async (t) => {
      if (req.body.answers) {
        for (const a of req.body.answers) {
          await AuditAnswer.upsert({
            audit_id: audit.id, question_id: a.question_id,
            score: a.score, answer: a.answer, comment: a.comment,
            attachment_url: a.attachment_url, photo_url: a.photo_url
          }, { transaction: t });
        }
      }
      const updates = { ...req.body };
      delete updates.answers;
      if (Object.keys(updates).length > 0) await audit.update(updates, { transaction: t });
    });
    res.json({ success: true, audit: await Audit.findByPk(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/validate', requireAuth, async (req, res) => {
  try {
    const { Audit, AuditAnswer, AuditQuestion, AuditGrid } = require('../models');
    const audit = await Audit.findByPk(req.params.id, {
      include: [{ model: AuditAnswer }, { model: AuditGrid, include: [{ model: AuditQuestion }] }]
    });
    if (!audit) return res.status(404).json({ success: false, message: 'Audit non trouve' });
    let totalScore = 0, count = 0;
    for (const q of (audit.audit_grid?.audit_questions || [])) {
      const a = (audit.audit_answers || []).find(ans => ans.question_id === q.id);
      if (a && a.score != null) { totalScore += a.score; count++; }
    }
    const score = count > 0 ? (totalScore / count).toFixed(2) : null;
    await audit.update({ status: 'completed', score, actual_date: new Date() });
    res.json({ success: true, audit, score });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
