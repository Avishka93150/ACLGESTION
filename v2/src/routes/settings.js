/**
 * ACL GESTION v2 - Settings Routes
 */
const router = require('express').Router();
const { sequelize } = require('../config/database');
const { RolePermission } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// GET /settings
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const settings = await query('SELECT * FROM system_config ORDER BY config_key ASC');
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.config_key] = s.config_value; });
    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /settings
router.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'settings doit etre un objet' });
    }

    for (const [key, value] of Object.entries(settings)) {
      await sequelize.query(
        'INSERT INTO system_config (config_key, config_value, created_at, updated_at) VALUES (:key, :value, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = :value, updated_at = NOW()',
        { replacements: { key, value: String(value) } }
      );
    }

    res.json({ success: true, message: 'Parametres mis a jour' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /settings/modules
router.get('/modules', requireAuth, async (req, res) => {
  try {
    const modules = await query("SELECT * FROM system_config WHERE config_key LIKE 'module_%' ORDER BY config_key ASC");
    const modulesObj = {};
    modules.forEach(m => { modulesObj[m.config_key.replace('module_', '')] = m.config_value === '1' || m.config_value === 'true'; });
    res.json({ success: true, modules: modulesObj });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /settings/modules
router.put('/modules', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { modules } = req.body;
    if (!modules || typeof modules !== 'object') {
      return res.status(400).json({ success: false, message: 'modules doit etre un objet' });
    }

    for (const [key, value] of Object.entries(modules)) {
      const configKey = 'module_' + key;
      await sequelize.query(
        'INSERT INTO system_config (config_key, config_value, created_at, updated_at) VALUES (:key, :value, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = :value, updated_at = NOW()',
        { replacements: { key: configKey, value: value ? '1' : '0' } }
      );
    }

    res.json({ success: true, message: 'Modules mis a jour' });
  } catch (error) {
    console.error('Update modules error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /settings/permissions
router.get('/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const permissions = await RolePermission.findAll({ order: [['role', 'ASC'], ['permission', 'ASC']] });
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /settings/permissions
router.put('/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions doit etre un tableau' });
    }

    for (const perm of permissions) {
      if (!perm.role || !perm.permission) continue;
      const existing = await RolePermission.findOne({ where: { role: perm.role, permission: perm.permission } });
      if (existing) {
        await existing.update({ allowed: perm.allowed ? 1 : 0 });
      } else {
        await RolePermission.create({ role: perm.role, permission: perm.permission, allowed: perm.allowed ? 1 : 0 });
      }
    }

    res.json({ success: true, message: 'Permissions mises a jour' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
