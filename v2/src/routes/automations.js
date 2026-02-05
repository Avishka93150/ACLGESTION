const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { Automation, User } = require('../models');
    const automations = await Automation.findAll({
      include: [{ model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['automation_type', 'ASC']]
    });
    res.json({ success: true, automations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { Automation } = require('../models');
    const automation = await Automation.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, automation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { Automation } = require('../models');
    const automation = await Automation.findByPk(req.params.id);
    if (!automation) return res.status(404).json({ success: false, message: 'Automation non trouvee' });
    await automation.update(req.body);
    res.json({ success: true, automation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { Automation } = require('../models');
    await Automation.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/logs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { AutomationLog } = require('../models');
    const logs = await AutomationLog.findAll({
      where: { automation_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit: 50
    });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
