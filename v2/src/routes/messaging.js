const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

router.get('/users', requireAuth, async (req, res) => {
  try {
    const { User } = require('../models');
    const users = await User.findAll({
      where: { status: 'active', id: { [Op.ne]: req.user.id } },
      attributes: ['id', 'first_name', 'last_name', 'role', 'email'],
      order: [['last_name', 'ASC']]
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const { Conversation, ConversationMessage, User } = require('../models');
    const conversations = await Conversation.findAll({
      where: { [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }] },
      include: [
        { model: User, as: 'user1', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'user2', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['last_message_at', 'DESC']]
    });
    // Ajouter le dernier message et le compteur non lu
    const result = [];
    for (const conv of conversations) {
      const lastMsg = await ConversationMessage.findOne({
        where: { conversation_id: conv.id },
        order: [['created_at', 'DESC']]
      });
      const unread = await ConversationMessage.count({
        where: { conversation_id: conv.id, sender_id: { [Op.ne]: req.user.id }, is_read: 0 }
      });
      result.push({ ...conv.toJSON(), last_message: lastMsg, unread_count: unread });
    }
    res.json({ success: true, conversations: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const { Conversation } = require('../models');
    const { user_id, hotel_id } = req.body;
    const uid1 = Math.min(req.user.id, user_id);
    const uid2 = Math.max(req.user.id, user_id);
    const [conversation] = await Conversation.findOrCreate({
      where: { user1_id: uid1, user2_id: uid2 },
      defaults: { user1_id: uid1, user2_id: uid2, hotel_id: hotel_id || null, last_message_at: new Date() }
    });
    res.json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { Conversation, ConversationMessage, User } = require('../models');
    const conversation = await Conversation.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user1', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'user2', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation non trouvee' });
    const messages = await ConversationMessage.findAll({
      where: { conversation_id: req.params.id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['created_at', 'ASC']],
      limit: 200
    });
    // Marquer comme lus
    await ConversationMessage.update(
      { is_read: 1 },
      { where: { conversation_id: req.params.id, sender_id: { [Op.ne]: req.user.id }, is_read: 0 } }
    );
    res.json({ success: true, conversation, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const { Conversation, ConversationMessage } = require('../models');
    const message = await ConversationMessage.create({
      conversation_id: req.params.id, sender_id: req.user.id,
      content: req.body.content, is_read: 0
    });
    await Conversation.update({ last_message_at: new Date() }, { where: { id: req.params.id } });
    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/conversations/:id/read', requireAuth, async (req, res) => {
  try {
    const { ConversationMessage } = require('../models');
    await ConversationMessage.update(
      { is_read: 1 },
      { where: { conversation_id: req.params.id, sender_id: { [Op.ne]: req.user.id }, is_read: 0 } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { Conversation, ConversationMessage } = require('../models');
    const conversations = await Conversation.findAll({
      where: { [Op.or]: [{ user1_id: req.user.id }, { user2_id: req.user.id }] },
      attributes: ['id']
    });
    const convIds = conversations.map(c => c.id);
    if (convIds.length === 0) return res.json({ success: true, count: 0 });
    const count = await ConversationMessage.count({
      where: { conversation_id: convIds, sender_id: { [Op.ne]: req.user.id }, is_read: 0 }
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
