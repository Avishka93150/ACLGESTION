/**
 * ACL GESTION v2 - Tasks Routes (Kanban)
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, UserHotel } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Helper to get raw query results (for tables not yet in Sequelize models)
async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// =============== BOARDS ===============

// GET /tasks/boards - List task boards
router.get('/boards', requireAuth, async (req, res) => {
  try {
    let sql = 'SELECT tb.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name FROM task_boards tb LEFT JOIN users u ON u.id = tb.created_by WHERE tb.is_archived = 0';
    const params = {};

    if (req.query.hotel_id) {
      sql += ' AND (tb.hotel_id = :hotel_id OR tb.id IN (SELECT board_id FROM task_board_hotels WHERE hotel_id = :hotel_id))';
      params.hotel_id = parseInt(req.query.hotel_id, 10);
    } else if (req.user.role !== 'admin') {
      const userHotels = await UserHotel.findAll({ where: { user_id: req.user.id } });
      const hotelIds = userHotels.map(uh => uh.hotel_id);
      if (hotelIds.length > 0) {
        sql += ' AND (tb.hotel_id IN (:hotelIds) OR tb.id IN (SELECT board_id FROM task_board_hotels WHERE hotel_id IN (:hotelIds)) OR tb.id IN (SELECT board_id FROM task_board_members WHERE user_id = :userId))';
        params.hotelIds = hotelIds;
        params.userId = req.user.id;
      } else {
        sql += ' AND tb.id IN (SELECT board_id FROM task_board_members WHERE user_id = :userId)';
        params.userId = req.user.id;
      }
    }

    sql += ' ORDER BY tb.created_at DESC';
    const boards = await query(sql, params);
    res.json({ success: true, boards });
  } catch (error) {
    console.error('List boards error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/boards - Create board
router.post('/boards', requireAuth, requirePermission('tasks.create'), async (req, res) => {
  try {
    const { name, description, color, hotel_id } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Le nom est requis' });
    }

    const [result] = await sequelize.query(
      'INSERT INTO task_boards (name, description, color, hotel_id, created_by, created_at, updated_at) VALUES (:name, :description, :color, :hotel_id, :created_by, NOW(), NOW())',
      { replacements: { name, description: description || null, color: color || '#1E3A5F', hotel_id: hotel_id || null, created_by: req.user.id } }
    );
    const boardId = result;

    // Create default columns
    const defaultColumns = ['A faire', 'En cours', 'Termine'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await sequelize.query(
        'INSERT INTO task_columns (board_id, name, position, created_at) VALUES (:boardId, :name, :position, NOW())',
        { replacements: { boardId, name: defaultColumns[i], position: i } }
      );
    }

    const boards = await query('SELECT * FROM task_boards WHERE id = :boardId', { boardId });
    res.status(201).json({ success: true, message: 'Tableau cree', board: boards[0] });
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /tasks/boards/:id - Update board
router.put('/boards/:id', requireAuth, async (req, res) => {
  try {
    const boardId = req.params.id;
    const boards = await query('SELECT * FROM task_boards WHERE id = :id', { id: boardId });
    if (boards.length === 0) {
      return res.status(404).json({ success: false, message: 'Tableau non trouve' });
    }

    const sets = [];
    const params = { id: boardId };
    if (req.body.name !== undefined) { sets.push('name = :name'); params.name = req.body.name; }
    if (req.body.description !== undefined) { sets.push('description = :description'); params.description = req.body.description; }
    if (req.body.color !== undefined) { sets.push('color = :color'); params.color = req.body.color; }
    if (req.body.is_archived !== undefined) { sets.push('is_archived = :is_archived'); params.is_archived = req.body.is_archived; }
    sets.push('updated_at = NOW()');

    await sequelize.query('UPDATE task_boards SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });
    const updated = await query('SELECT * FROM task_boards WHERE id = :id', { id: boardId });
    res.json({ success: true, message: 'Tableau mis a jour', board: updated[0] });
  } catch (error) {
    console.error('Update board error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /tasks/boards/:id - Delete board
router.delete('/boards/:id', requireAuth, async (req, res) => {
  try {
    const boardId = req.params.id;
    const boards = await query('SELECT * FROM task_boards WHERE id = :id', { id: boardId });
    if (boards.length === 0) {
      return res.status(404).json({ success: false, message: 'Tableau non trouve' });
    }

    await sequelize.query('DELETE FROM task_label_assignments WHERE label_id IN (SELECT id FROM task_labels WHERE board_id = :id)', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_checklists WHERE task_id IN (SELECT id FROM tasks WHERE board_id = :id)', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE board_id = :id)', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE board_id = :id)', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE board_id = :id)', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM tasks WHERE board_id = :id', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_columns WHERE board_id = :id', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_labels WHERE board_id = :id', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_board_members WHERE board_id = :id', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_board_hotels WHERE board_id = :id', { replacements: { id: boardId } });
    await sequelize.query('DELETE FROM task_boards WHERE id = :id', { replacements: { id: boardId } });

    res.json({ success: true, message: 'Tableau supprime' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =============== COLUMNS ===============

// GET /tasks/boards/:boardId/columns
router.get('/boards/:boardId/columns', requireAuth, async (req, res) => {
  try {
    const columns = await query('SELECT * FROM task_columns WHERE board_id = :boardId ORDER BY position ASC', { boardId: req.params.boardId });
    res.json({ success: true, columns });
  } catch (error) {
    console.error('List columns error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/boards/:boardId/columns
router.post('/boards/:boardId/columns', requireAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis' });

    const maxPos = await query('SELECT MAX(position) as max_pos FROM task_columns WHERE board_id = :boardId', { boardId: req.params.boardId });
    const position = (maxPos[0].max_pos || 0) + 1;

    const [result] = await sequelize.query(
      'INSERT INTO task_columns (board_id, name, position, color, created_at) VALUES (:boardId, :name, :position, :color, NOW())',
      { replacements: { boardId: req.params.boardId, name, position, color: color || '#6B7280' } }
    );

    const columns = await query('SELECT * FROM task_columns WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Colonne creee', column: columns[0] });
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /tasks/columns/:id
router.put('/columns/:id', requireAuth, async (req, res) => {
  try {
    const sets = [];
    const params = { id: req.params.id };
    if (req.body.name !== undefined) { sets.push('name = :name'); params.name = req.body.name; }
    if (req.body.position !== undefined) { sets.push('position = :position'); params.position = req.body.position; }
    if (req.body.color !== undefined) { sets.push('color = :color'); params.color = req.body.color; }
    if (sets.length === 0) return res.status(400).json({ success: false, message: 'Aucune modification' });

    await sequelize.query('UPDATE task_columns SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });
    const columns = await query('SELECT * FROM task_columns WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Colonne mise a jour', column: columns[0] });
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /tasks/columns/:id
router.delete('/columns/:id', requireAuth, async (req, res) => {
  try {
    const columns = await query('SELECT * FROM task_columns WHERE id = :id', { id: req.params.id });
    if (columns.length === 0) return res.status(404).json({ success: false, message: 'Colonne non trouvee' });

    const otherColumns = await query('SELECT id FROM task_columns WHERE board_id = :boardId AND id != :id ORDER BY position ASC LIMIT 1', { boardId: columns[0].board_id, id: req.params.id });
    if (otherColumns.length > 0) {
      await sequelize.query('UPDATE tasks SET column_id = :newCol WHERE column_id = :oldCol', { replacements: { newCol: otherColumns[0].id, oldCol: req.params.id } });
    } else {
      await sequelize.query('DELETE FROM tasks WHERE column_id = :id', { replacements: { id: req.params.id } });
    }

    await sequelize.query('DELETE FROM task_columns WHERE id = :id', { replacements: { id: req.params.id } });
    res.json({ success: true, message: 'Colonne supprimee' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =============== TASKS ===============

// GET /tasks/boards/:boardId/tasks
router.get('/boards/:boardId/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await query(
      'SELECT t.*, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name, (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comments_count FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to WHERE t.board_id = :boardId ORDER BY t.column_id ASC, t.position ASC',
      { boardId: req.params.boardId }
    );

    const taskIds = tasks.map(t => t.id);
    let checklists = [];
    if (taskIds.length > 0) {
      checklists = await query('SELECT * FROM task_checklists WHERE task_id IN (:taskIds) ORDER BY position ASC', { taskIds });
    }
    const checklistMap = {};
    checklists.forEach(cl => {
      if (!checklistMap[cl.task_id]) checklistMap[cl.task_id] = [];
      checklistMap[cl.task_id].push(cl);
    });

    const enriched = tasks.map(t => ({
      ...t,
      assignee_name: t.assignee_first_name ? t.assignee_first_name + ' ' + t.assignee_last_name : null,
      checklists: checklistMap[t.id] || []
    }));

    res.json({ success: true, tasks: enriched });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/boards/:boardId/tasks
router.post('/boards/:boardId/tasks', requireAuth, async (req, res) => {
  try {
    const { title, description, priority, due_date, assigned_to, column_id, position } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Le titre est requis' });

    let colId = column_id;
    if (!colId) {
      const cols = await query('SELECT id FROM task_columns WHERE board_id = :boardId ORDER BY position ASC LIMIT 1', { boardId: req.params.boardId });
      if (cols.length === 0) return res.status(400).json({ success: false, message: 'Aucune colonne dans ce tableau' });
      colId = cols[0].id;
    }

    let pos = position;
    if (pos === undefined) {
      const maxPos = await query('SELECT MAX(position) as max_pos FROM tasks WHERE column_id = :colId', { colId });
      pos = (maxPos[0].max_pos || 0) + 1;
    }

    const [result] = await sequelize.query(
      'INSERT INTO tasks (board_id, column_id, title, description, priority, due_date, assigned_to, position, created_by, created_at, updated_at) VALUES (:boardId, :colId, :title, :description, :priority, :due_date, :assigned_to, :position, :created_by, NOW(), NOW())',
      { replacements: { boardId: req.params.boardId, colId, title, description: description || null, priority: priority || 'medium', due_date: due_date || null, assigned_to: assigned_to || null, position: pos, created_by: req.user.id } }
    );

    const tasks = await query('SELECT * FROM tasks WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Tache creee', task: tasks[0] });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /tasks/tasks/:id
router.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const existing = await query('SELECT * FROM tasks WHERE id = :id', { id: taskId });
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Tache non trouvee' });

    const allowedFields = ['title', 'description', 'priority', 'due_date', 'column_id', 'position', 'assigned_to', 'is_completed'];
    const sets = [];
    const params = { id: taskId };

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) { sets.push(field + ' = :' + field); params[field] = req.body[field]; }
    });

    if (req.body.is_completed === 1 || req.body.is_completed === true) {
      sets.push('completed_at = NOW()');
      sets.push('completed_by = :completed_by');
      params.completed_by = req.user.id;
    }
    sets.push('updated_at = NOW()');

    await sequelize.query('UPDATE tasks SET ' + sets.join(', ') + ' WHERE id = :id', { replacements: params });
    const updated = await query('SELECT * FROM tasks WHERE id = :id', { id: taskId });
    res.json({ success: true, message: 'Tache mise a jour', task: updated[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /tasks/tasks/:id
router.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const existing = await query('SELECT * FROM tasks WHERE id = :id', { id: taskId });
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Tache non trouvee' });

    await sequelize.query('DELETE FROM task_checklists WHERE task_id = :id', { replacements: { id: taskId } });
    await sequelize.query('DELETE FROM task_comments WHERE task_id = :id', { replacements: { id: taskId } });
    await sequelize.query('DELETE FROM task_label_assignments WHERE task_id = :id', { replacements: { id: taskId } });
    await sequelize.query('DELETE FROM task_assignees WHERE task_id = :id', { replacements: { id: taskId } });
    await sequelize.query('DELETE FROM task_attachments WHERE task_id = :id', { replacements: { id: taskId } });
    await sequelize.query('DELETE FROM tasks WHERE id = :id', { replacements: { id: taskId } });

    res.json({ success: true, message: 'Tache supprimee' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/tasks/:id/comments
router.post('/tasks/:id/comments', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: 'Le commentaire est requis' });

    const existing = await query('SELECT * FROM tasks WHERE id = :id', { id: req.params.id });
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Tache non trouvee' });

    const [result] = await sequelize.query(
      'INSERT INTO task_comments (task_id, user_id, comment, created_at) VALUES (:taskId, :userId, :comment, NOW())',
      { replacements: { taskId: req.params.id, userId: req.user.id, comment } }
    );

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'first_name', 'last_name'] });
    res.status(201).json({
      success: true,
      message: 'Commentaire ajoute',
      comment: { id: result, task_id: parseInt(req.params.id, 10), user_id: req.user.id, comment, user_name: user ? user.first_name + ' ' + user.last_name : null, created_at: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Add task comment error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/tasks/:id/checklist
router.post('/tasks/:id/checklist', requireAuth, async (req, res) => {
  try {
    const { item_text } = req.body;
    if (!item_text) return res.status(400).json({ success: false, message: 'Le texte est requis' });

    const existing = await query('SELECT * FROM tasks WHERE id = :id', { id: req.params.id });
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Tache non trouvee' });

    const maxPos = await query('SELECT MAX(position) as max_pos FROM task_checklists WHERE task_id = :taskId', { taskId: req.params.id });
    const position = (maxPos[0].max_pos || 0) + 1;

    const [result] = await sequelize.query(
      'INSERT INTO task_checklists (task_id, item_text, is_checked, position, created_at) VALUES (:taskId, :item_text, 0, :position, NOW())',
      { replacements: { taskId: req.params.id, item_text, position } }
    );

    const items = await query('SELECT * FROM task_checklists WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Element ajoute', item: items[0] });
  } catch (error) {
    console.error('Add checklist item error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /tasks/checklist/:id
router.put('/checklist/:id', requireAuth, async (req, res) => {
  try {
    const items = await query('SELECT * FROM task_checklists WHERE id = :id', { id: req.params.id });
    if (items.length === 0) return res.status(404).json({ success: false, message: 'Element non trouve' });

    const newChecked = items[0].is_checked ? 0 : 1;
    await sequelize.query('UPDATE task_checklists SET is_checked = :checked, checked_by = :userId, checked_at = NOW() WHERE id = :id', { replacements: { checked: newChecked, userId: req.user.id, id: req.params.id } });

    const updated = await query('SELECT * FROM task_checklists WHERE id = :id', { id: req.params.id });
    res.json({ success: true, message: 'Element mis a jour', item: updated[0] });
  } catch (error) {
    console.error('Toggle checklist error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// =============== LABELS ===============

// GET /tasks/boards/:boardId/labels
router.get('/boards/:boardId/labels', requireAuth, async (req, res) => {
  try {
    const labels = await query('SELECT * FROM task_labels WHERE board_id = :boardId ORDER BY name ASC', { boardId: req.params.boardId });
    res.json({ success: true, labels });
  } catch (error) {
    console.error('List labels error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /tasks/boards/:boardId/labels
router.post('/boards/:boardId/labels', requireAuth, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ success: false, message: 'Nom et couleur requis' });

    const [result] = await sequelize.query('INSERT INTO task_labels (board_id, name, color) VALUES (:boardId, :name, :color)', { replacements: { boardId: req.params.boardId, name, color } });
    const labels = await query('SELECT * FROM task_labels WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Label cree', label: labels[0] });
  } catch (error) {
    console.error('Create label error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
