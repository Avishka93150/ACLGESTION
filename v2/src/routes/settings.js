const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { SystemConfig } = require('../models');
    const settings = await SystemConfig.findAll();
    const result = {};
    settings.forEach(s => { result[s.setting_key] = s.setting_value; });
    res.json({ success: true, settings: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { SystemConfig } = require('../models');
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings || {})) {
      await SystemConfig.upsert({ setting_key: key, setting_value: String(value) });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/modules', requireAuth, async (req, res) => {
  try {
    const { SystemConfig } = require('../models');
    const { Op } = require('sequelize');
    const modules = await SystemConfig.findAll({
      where: { setting_key: { [Op.like]: '%_enabled' } }
    });
    const result = {};
    modules.forEach(m => { result[m.setting_key.replace('_enabled', '')] = m.setting_value === 'true'; });
    res.json({ success: true, modules: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/modules', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { SystemConfig } = require('../models');
    const { modules } = req.body;
    for (const [key, enabled] of Object.entries(modules || {})) {
      await SystemConfig.upsert({ setting_key: `${key}_enabled`, setting_value: String(enabled) });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { RolePermission } = require('../models');
    const perms = await RolePermission.findAll();
    res.json({ success: true, permissions: perms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/permissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { RolePermission } = require('../models');
    const { permissions } = req.body;
    for (const p of permissions || []) {
      await RolePermission.upsert({ role: p.role, permission: p.permission, allowed: p.allowed ? 1 : 0 });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
