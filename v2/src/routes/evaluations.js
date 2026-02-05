const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { Op } = require('sequelize');

// ======================== GRIDS ========================

router.get('/grids', requireAuth, async (req, res) => {
  try {
    const { EvaluationGrid, EvaluationQuestion } = require('../models');
    const grids = await EvaluationGrid.findAll({
      where: { is_active: 1 },
      include: [{ model: EvaluationQuestion, attributes: ['id'] }],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, grids: grids.map(g => ({
      ...g.toJSON(), question_count: g.evaluation_questions ? g.evaluation_questions.length : 0
    }))});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grids', requireAuth, requirePermission('evaluations.grids'), async (req, res) => {
  try {
    const { EvaluationGrid } = require('../models');
    const grid = await EvaluationGrid.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/grids/full', requireAuth, requirePermission('evaluations.grids'), async (req, res) => {
  try {
    const { EvaluationGrid, EvaluationQuestion, sequelize } = require('../models');
    const { grid: gridData, questions } = req.body;
    const result = await sequelize.transaction(async (t) => {
      const grid = await EvaluationGrid.create({ ...gridData, created_by: req.user.id }, { transaction: t });
      if (questions && questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          await EvaluationQuestion.create({
            ...questions[i], grid_id: grid.id, position: i
          }, { transaction: t });
        }
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
    const { EvaluationGrid, EvaluationQuestion } = require('../models');
    const grid = await EvaluationGrid.findByPk(req.params.id, {
      include: [{ model: EvaluationQuestion, order: [['position', 'ASC']] }]
    });
    if (!grid) return res.status(404).json({ success: false, message: 'Grille non trouvee' });
    res.json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/grids/:id', requireAuth, requirePermission('evaluations.grids'), async (req, res) => {
  try {
    const { EvaluationGrid } = require('../models');
    const grid = await EvaluationGrid.findByPk(req.params.id);
    if (!grid) return res.status(404).json({ success: false, message: 'Grille non trouvee' });
    await grid.update(req.body);
    res.json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/grids/:id', requireAuth, requirePermission('evaluations.grids'), async (req, res) => {
  try {
    const { EvaluationGrid } = require('../models');
    await EvaluationGrid.update({ is_active: 0 }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================== EVALUATIONS ========================

router.get('/', requireAuth, async (req, res) => {
  try {
    const { Evaluation, EvaluationGrid, User, Hotel } = require('../models');
    const where = {};
    if (req.query.hotel_id) where.hotel_id = req.query.hotel_id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.grid_id) where.grid_id = req.query.grid_id;

    const evaluations = await Evaluation.findAll({
      where,
      include: [
        { model: EvaluationGrid, attributes: ['id', 'name'] },
        { model: User, as: 'evaluatedUser', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'evaluator', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, evaluations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, requirePermission('evaluations.evaluate'), async (req, res) => {
  try {
    const { Evaluation } = require('../models');
    const evaluation = await Evaluation.create({
      ...req.body, evaluator_id: req.user.id, status: 'draft'
    });
    res.status(201).json({ success: true, evaluation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { Evaluation, EvaluationGrid, User } = require('../models');
    const evaluations = await Evaluation.findAll({
      where: { evaluated_user_id: req.user.id },
      include: [
        { model: EvaluationGrid, attributes: ['id', 'name'] },
        { model: User, as: 'evaluator', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, evaluations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/users', requireAuth, async (req, res) => {
  try {
    const { User } = require('../models');
    const where = { status: 'active' };
    if (req.query.role) where.role = req.query.role;
    const users = await User.findAll({
      where,
      attributes: ['id', 'first_name', 'last_name', 'role', 'email']
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { Evaluation } = require('../models');
    const total = await Evaluation.count();
    const draft = await Evaluation.count({ where: { status: 'draft' } });
    const validated = await Evaluation.count({ where: { status: 'validated' } });
    res.json({ success: true, stats: { total, draft, validated } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { Evaluation, EvaluationGrid, EvaluationQuestion, EvaluationAnswer, User, Hotel } = require('../models');
    const evaluation = await Evaluation.findByPk(req.params.id, {
      include: [
        { model: EvaluationGrid, include: [{ model: EvaluationQuestion, order: [['position', 'ASC']] }] },
        { model: EvaluationAnswer, include: [{ model: EvaluationQuestion }] },
        { model: User, as: 'evaluatedUser', attributes: ['id', 'first_name', 'last_name', 'role'] },
        { model: User, as: 'evaluator', attributes: ['id', 'first_name', 'last_name'] },
        { model: Hotel, attributes: ['id', 'name'] }
      ]
    });
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });
    res.json({ success: true, evaluation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { Evaluation, EvaluationAnswer, sequelize } = require('../models');
    const evaluation = await Evaluation.findByPk(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });

    await sequelize.transaction(async (t) => {
      if (req.body.answers) {
        for (const answer of req.body.answers) {
          await EvaluationAnswer.upsert({
            evaluation_id: evaluation.id,
            question_id: answer.question_id,
            score: answer.score, answer: answer.answer,
            comment: answer.comment, attachment_url: answer.attachment_url
          }, { transaction: t });
        }
      }
      if (req.body.global_comment !== undefined) {
        await evaluation.update({ global_comment: req.body.global_comment }, { transaction: t });
      }
      if (req.body.conclusion !== undefined) {
        await evaluation.update({ conclusion: req.body.conclusion }, { transaction: t });
      }
    });
    res.json({ success: true, evaluation: await Evaluation.findByPk(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/validate', requireAuth, async (req, res) => {
  try {
    const { Evaluation, EvaluationAnswer, EvaluationQuestion, EvaluationGrid } = require('../models');
    const evaluation = await Evaluation.findByPk(req.params.id, {
      include: [
        { model: EvaluationAnswer },
        { model: EvaluationGrid, include: [{ model: EvaluationQuestion }] }
      ]
    });
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });

    // Calculer les scores
    let totalScore = 0, totalWeight = 0, scoreCount = 0;
    const questions = evaluation.evaluation_grid?.evaluation_questions || [];
    const answers = evaluation.evaluation_answers || [];

    for (const q of questions) {
      const answer = answers.find(a => a.question_id === q.id);
      if (answer && answer.score !== null) {
        totalScore += answer.score;
        totalWeight += (answer.score * (q.weight || 1));
        scoreCount++;
      }
    }

    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(2) : null;
    const weightedScore = scoreCount > 0 ? (totalWeight / questions.reduce((s, q) => s + (q.weight || 1), 0)).toFixed(2) : null;

    await evaluation.update({
      status: 'validated', score: avgScore,
      weighted_score: weightedScore, validated_at: new Date()
    });

    res.json({ success: true, evaluation, score: avgScore, weighted_score: weightedScore });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
