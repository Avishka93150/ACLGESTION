/**
 * ACL GESTION v2 - Evaluations Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, UserHotel, Hotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// =============== GRIDS ===============

// GET /evaluations/grids - List grids with question count
router.get('/grids', requireAuth, async (req, res) => {
  try {
    const grids = await query(
      'SELECT eg.*, (SELECT COUNT(*) FROM evaluation_questions eq WHERE eq.grid_id = eg.id) AS question_count, u.first_name AS creator_first_name, u.last_name AS creator_last_name FROM evaluation_grids eg LEFT JOIN users u ON u.id = eg.created_by WHERE eg.is_active = 1 ORDER BY eg.created_at DESC'
    );
    res.json({ success: true, grids });
  } catch (error) {
    console.error('List grids error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /evaluations/grids - Create grid
router.post('/grids', requireAuth, requirePermission('evaluations.grids'), async (req, res) => {
  try {
    const { name, hotel_id, target_role, periodicity, instructions, allow_attachment } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis' });

    const [result] = await sequelize.query(
      'INSERT INTO evaluation_grids (name, hotel_id, target_role, periodicity, instructions, allow_attachment, is_active, created_by, created_at, updated_at) VALUES (:name, :hotel_id, :target_role, :periodicity, :instructions, :allow_attachment, 1, :created_by, NOW(), NOW())',
      { replacements: { name, hotel_id: hotel_id || null, target_role: target_role || 'employee', periodicity: periodicity || 'quarterly', instructions: instructions || null, allow_attachment: allow_attachment || 0, created_by: req.user.id } }
    );

    const grids = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Grille creee', grid: grids[0] });
  } catch (error) {
    console.error('Create grid error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /evaluations/grids/full - Create grid with questions
router.post('/grids/full', requireAuth, async (req, res) => {
  try {
    const { name, hotel_id, target_role, periodicity, instructions, allow_attachment, questions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis' });

    const [gridId] = await sequelize.query(
      'INSERT INTO evaluation_grids (name, hotel_id, target_role, periodicity, instructions, allow_attachment, is_active, created_by, created_at, updated_at) VALUES (:name, :hotel_id, :target_role, :periodicity, :instructions, :allow_attachment, 1, :created_by, NOW(), NOW())',
      { replacements: { name, hotel_id: hotel_id || null, target_role: target_role || 'employee', periodicity: periodicity || 'quarterly', instructions: instructions || null, allow_attachment: allow_attachment || 0, created_by: req.user.id } }
    );

    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await sequelize.query(
          'INSERT INTO evaluation_questions (grid_id, question_text, category, weight, response_type, min_score, max_score, choices, multiple_selection, position, is_required, comment_required, file_optional, file_required, created_at) VALUES (:grid_id, :question_text, :category, :weight, :response_type, :min_score, :max_score, :choices, :multiple_selection, :position, :is_required, :comment_required, :file_optional, :file_required, NOW())',
          { replacements: { grid_id: gridId, question_text: q.question_text, category: q.category || null, weight: q.weight || 1.0, response_type: q.response_type || 'score', min_score: q.min_score || 1, max_score: q.max_score || 10, choices: q.choices || null, multiple_selection: q.multiple_selection || 0, position: q.position !== undefined ? q.position : i, is_required: q.is_required !== undefined ? q.is_required : 1, comment_required: q.comment_required || 0, file_optional: q.file_optional || 0, file_required: q.file_required || 0 } }
        );
      }
    }

    const grids = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: gridId });
    const gridQuestions = await query('SELECT * FROM evaluation_questions WHERE grid_id = :id ORDER BY position ASC', { id: gridId });
    res.status(201).json({ success: true, message: 'Grille creee avec questions', grid: { ...grids[0], questions: gridQuestions } });
  } catch (error) {
    console.error('Create full grid error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /evaluations/grids/:id - Get grid with questions
router.get('/grids/:id', requireAuth, async (req, res) => {
  try {
    const grids = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: req.params.id });
    if (grids.length === 0) return res.status(404).json({ success: false, message: 'Grille non trouvee' });

    const questions = await query('SELECT * FROM evaluation_questions WHERE grid_id = :id ORDER BY position ASC', { id: req.params.id });
    res.json({ success: true, grid: { ...grids[0], questions } });
  } catch (error) {
    console.error('Get grid error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /evaluations/grids/:id - Update grid
router.put('/grids/:id', requireAuth, async (req, res) => {
  try {
    const grids = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: req.params.id });
    if (grids.length === 0) return res.status(404).json({ success: false, message: 'Grille non trouvee' });

    const allowedFields = ['name', 'hotel_id', 'target_role', 'periodicity', 'instructions', 'allow_attachment', 'is_active'];
    const sets = [];
    const params = { id: req.params.id };
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) { sets.push(field + ' = :' + field); params[field] = req.body[field]; }
    });
    sets.push('updated_at = NOW()');

    await sequelize.query('UPDATE evaluation_grids SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });
    const updated = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Grille mise a jour', grid: updated[0] });
  } catch (error) {
    console.error('Update grid error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /evaluations/grids/:id - Deactivate grid
router.delete('/grids/:id', requireAuth, async (req, res) => {
  try {
    const grids = await query('SELECT * FROM evaluation_grids WHERE id = :id', { id: req.params.id });
    if (grids.length === 0) return res.status(404).json({ success: false, message: 'Grille non trouvee' });

    await sequelize.query('UPDATE evaluation_grids SET is_active = 0, updated_at = NOW() WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ success: true, message: 'Grille desactivee' });
  } catch (error) {
    console.error('Delete grid error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =============== EVALUATIONS ===============

// GET /evaluations/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const evaluations = await query(
      'SELECT e.*, eg.name AS grid_name, h.name AS hotel_name, u.first_name AS evaluator_first_name, u.last_name AS evaluator_last_name FROM evaluations e LEFT JOIN evaluation_grids eg ON eg.id = e.grid_id LEFT JOIN hotels h ON h.id = e.hotel_id LEFT JOIN users u ON u.id = e.evaluator_id WHERE e.evaluated_user_id = :userId ORDER BY e.evaluation_date DESC',
      { userId: req.user.id }
    );
    res.json({ success: true, evaluations });
  } catch (error) {
    console.error('My evaluations error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /evaluations/users
router.get('/users', requireAuth, async (req, res) => {
  try {
    let users;
    if (req.user.role === 'admin') {
      users = await User.findAll({ where: { status: 'active' }, attributes: ['id', 'first_name', 'last_name', 'email', 'role'], order: [['last_name', 'ASC']] });
    } else {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) {
        const assignments = await UserHotel.findAll({ where: { hotel_id: { [Op.in]: hotelIds } }, attributes: ['user_id'] });
        const userIds = [...new Set(assignments.map(a => a.user_id))];
        users = await User.findAll({ where: { id: { [Op.in]: userIds }, status: 'active' }, attributes: ['id', 'first_name', 'last_name', 'email', 'role'], order: [['last_name', 'ASC']] });
      } else {
        users = [];
      }
    }
    res.json({ success: true, users });
  } catch (error) {
    console.error('Evaluatable users error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /evaluations/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const params = {};
    let hotelFilter = '';
    if (req.query.hotel_id) { hotelFilter = ' AND e.hotel_id = :hotel_id'; params.hotel_id = parseInt(req.query.hotel_id, 10); }

    const total = await query('SELECT COUNT(*) as count FROM evaluations e WHERE 1=1' + hotelFilter, params);
    const byStatus = await query('SELECT status, COUNT(*) as count FROM evaluations e WHERE 1=1' + hotelFilter + ' GROUP BY status', params);
    const avgScore = await query("SELECT AVG(score_weighted) as avg_score FROM evaluations e WHERE status = 'validated'" + hotelFilter, params);

    res.json({
      success: true,
      stats: {
        total: total[0].count,
        byStatus: byStatus.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
        averageScore: avgScore[0].avg_score ? parseFloat(avgScore[0].avg_score).toFixed(2) : null
      }
    });
  } catch (error) {
    console.error('Evaluation stats error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /evaluations - List evaluations
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT e.*, eg.name AS grid_name, h.name AS hotel_name, eu.first_name AS evaluated_first_name, eu.last_name AS evaluated_last_name, ev.first_name AS evaluator_first_name, ev.last_name AS evaluator_last_name FROM evaluations e LEFT JOIN evaluation_grids eg ON eg.id = e.grid_id LEFT JOIN hotels h ON h.id = e.hotel_id LEFT JOIN users eu ON eu.id = e.evaluated_user_id LEFT JOIN users ev ON ev.id = e.evaluator_id WHERE 1=1';
    const params = {};

    if (req.query.hotel_id) { sql += ' AND e.hotel_id = :hotel_id'; params.hotel_id = parseInt(req.query.hotel_id, 10); }
    if (req.query.status) { sql += ' AND e.status = :status'; params.status = req.query.status; }
    if (req.query.grid_id) { sql += ' AND e.grid_id = :grid_id'; params.grid_id = parseInt(req.query.grid_id, 10); }
    sql += ' ORDER BY e.evaluation_date DESC LIMIT 100';

    const evaluations = await query(sql, params);
    res.json({ success: true, evaluations });
  } catch (error) {
    console.error('List evaluations error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /evaluations - Create evaluation
router.post('/', requireAuth, requirePermission('evaluations.evaluate'), async (req, res) => {
  try {
    const { grid_id, hotel_id, evaluated_user_id, evaluation_date, period_start, period_end, global_comment } = req.body;
    if (!grid_id || !hotel_id || !evaluated_user_id) {
      return res.status(400).json({ success: false, message: 'grid_id, hotel_id et evaluated_user_id sont requis' });
    }

    const [result] = await sequelize.query(
      "INSERT INTO evaluations (grid_id, hotel_id, evaluated_user_id, evaluator_id, evaluation_date, period_start, period_end, global_comment, status, created_at, updated_at) VALUES (:grid_id, :hotel_id, :evaluated_user_id, :evaluator_id, :evaluation_date, :period_start, :period_end, :global_comment, 'draft', NOW(), NOW())",
      { replacements: { grid_id, hotel_id, evaluated_user_id, evaluator_id: req.user.id, evaluation_date: evaluation_date || new Date().toISOString().split('T')[0], period_start: period_start || null, period_end: period_end || null, global_comment: global_comment || null } }
    );

    const evaluations = await query('SELECT * FROM evaluations WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Evaluation creee', evaluation: evaluations[0] });
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /evaluations/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const evaluations = await query(
      'SELECT e.*, eg.name AS grid_name, h.name AS hotel_name, eu.first_name AS evaluated_first_name, eu.last_name AS evaluated_last_name, ev.first_name AS evaluator_first_name, ev.last_name AS evaluator_last_name FROM evaluations e LEFT JOIN evaluation_grids eg ON eg.id = e.grid_id LEFT JOIN hotels h ON h.id = e.hotel_id LEFT JOIN users eu ON eu.id = e.evaluated_user_id LEFT JOIN users ev ON ev.id = e.evaluator_id WHERE e.id = :id',
      { id: req.params.id }
    );
    if (evaluations.length === 0) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });

    const questions = await query('SELECT * FROM evaluation_questions WHERE grid_id = :gridId ORDER BY position ASC', { gridId: evaluations[0].grid_id });
    const answers = await query('SELECT * FROM evaluation_answers WHERE evaluation_id = :id', { id: req.params.id });

    res.json({ success: true, evaluation: { ...evaluations[0], questions, answers } });
  } catch (error) {
    console.error('Get evaluation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /evaluations/:id - Save draft answers
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const evaluations = await query('SELECT * FROM evaluations WHERE id = :id', { id: req.params.id });
    if (evaluations.length === 0) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });

    const { global_comment, conclusion, answers } = req.body;
    const sets = ['updated_at = NOW()'];
    const params = { id: req.params.id };
    if (global_comment !== undefined) { sets.push('global_comment = :global_comment'); params.global_comment = global_comment; }
    if (conclusion !== undefined) { sets.push('conclusion = :conclusion'); params.conclusion = conclusion; }

    await sequelize.query('UPDATE evaluations SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });

    if (answers && Array.isArray(answers)) {
      for (const answer of answers) {
        const existing = await query('SELECT id FROM evaluation_answers WHERE evaluation_id = :evalId AND question_id = :qId', { evalId: req.params.id, qId: answer.question_id });
        if (existing.length > 0) {
          await sequelize.query(
            'UPDATE evaluation_answers SET score = :score, answer_yesno = :answer_yesno, answer_choice = :answer_choice, answer_text = :answer_text, comment = :comment, file_url = :file_url WHERE id = :id',
            { replacements: { id: existing[0].id, score: answer.score !== undefined ? answer.score : null, answer_yesno: answer.answer_yesno || null, answer_choice: answer.answer_choice || null, answer_text: answer.answer_text || null, comment: answer.comment || null, file_url: answer.file_url || null } }
          );
        } else {
          await sequelize.query(
            'INSERT INTO evaluation_answers (evaluation_id, question_id, score, answer_yesno, answer_choice, answer_text, comment, file_url) VALUES (:evalId, :qId, :score, :answer_yesno, :answer_choice, :answer_text, :comment, :file_url)',
            { replacements: { evalId: req.params.id, qId: answer.question_id, score: answer.score !== undefined ? answer.score : null, answer_yesno: answer.answer_yesno || null, answer_choice: answer.answer_choice || null, answer_text: answer.answer_text || null, comment: answer.comment || null, file_url: answer.file_url || null } }
          );
        }
      }
    }

    res.json({ success: true, message: 'Evaluation mise a jour' });
  } catch (error) {
    console.error('Update evaluation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /evaluations/:id/validate
router.post('/:id/validate', requireAuth, async (req, res) => {
  try {
    const evaluations = await query('SELECT * FROM evaluations WHERE id = :id', { id: req.params.id });
    if (evaluations.length === 0) return res.status(404).json({ success: false, message: 'Evaluation non trouvee' });

    const answersWithWeights = await query(
      'SELECT ea.*, eq.weight, eq.max_score, eq.response_type FROM evaluation_answers ea JOIN evaluation_questions eq ON eq.id = ea.question_id WHERE ea.evaluation_id = :id',
      { id: req.params.id }
    );

    let totalScore = 0, totalWeight = 0, scoreCount = 0, scoreSum = 0;
    answersWithWeights.forEach(a => {
      if (a.response_type === 'score' && a.score !== null) {
        const normalizedScore = (a.score / a.max_score) * 10;
        totalScore += normalizedScore * (a.weight || 1);
        totalWeight += (a.weight || 1);
        scoreSum += a.score;
        scoreCount++;
      }
    });

    const scoreSimple = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(2) : null;
    const scoreWeighted = totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) : null;

    await sequelize.query(
      "UPDATE evaluations SET status = 'validated', score_simple = :scoreSimple, score_weighted = :scoreWeighted, validated_at = NOW(), updated_at = NOW() WHERE id = :id",
      { replacements: { id: req.params.id, scoreSimple, scoreWeighted } }
    );

    const updated = await query('SELECT * FROM evaluations WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Evaluation validee', evaluation: updated[0], scores: { score_simple: scoreSimple, score_weighted: scoreWeighted } });
  } catch (error) {
    console.error('Validate evaluation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
