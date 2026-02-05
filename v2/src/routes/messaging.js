/**
 * ACL GESTION v2 - Messaging Routes
 */
const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User } = require('../models');
const { requireAuth } = require('../middleware/auth');

async function query(sql, replacements = {}) {
  const [results] = await sequelize.query(sql, { replacements });
  return results;
}

// GET /messages/users - List users for messaging (exclude self)
router.get('/users', requireAuth, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { id: { [Op.ne]: req.user.id }, status: 'active' },
      attributes: ['id', 'first_name', 'last_name', 'role', 'email'],
      order: [['last_name', 'ASC']]
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error('List messaging users error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /messages/conversations - List conversations with last message
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const conversations = await query(
      'SELECT c.*, CASE WHEN c.user1_id = :userId THEN u2.first_name ELSE u1.first_name END AS other_first_name, CASE WHEN c.user1_id = :userId THEN u2.last_name ELSE u1.last_name END AS other_last_name, CASE WHEN c.user1_id = :userId THEN c.user2_id ELSE c.user1_id END AS other_user_id, (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id AND cm.sender_id != :userId AND cm.is_read = 0) AS unread_count FROM conversations c LEFT JOIN users u1 ON u1.id = c.user1_id LEFT JOIN users u2 ON u2.id = c.user2_id WHERE c.user1_id = :userId OR c.user2_id = :userId ORDER BY c.last_at DESC',
      { userId: req.user.id }
    );
    res.json({ success: true, conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /messages/conversations - Create or get conversation
router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id est requis' });

    const otherUser = await User.findByPk(user_id);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Utilisateur non trouve' });

    // Check if conversation exists (either direction)
    const user1 = Math.min(req.user.id, user_id);
    const user2 = Math.max(req.user.id, user_id);

    let conversation = await query(
      'SELECT * FROM conversations WHERE (user1_id = :u1 AND user2_id = :u2) OR (user1_id = :u2 AND user2_id = :u1) LIMIT 1',
      { u1: user1, u2: user2 }
    );

    if (conversation.length > 0) {
      return res.json({ success: true, conversation: conversation[0], created: false });
    }

    // Create new conversation
    const [result] = await sequelize.query(
      'INSERT INTO conversations (user1_id, user2_id, created_at) VALUES (:u1, :u2, NOW())',
      { replacements: { u1: user1, u2: user2 } }
    );

    conversation = await query('SELECT * FROM conversations WHERE id = :id', { id: result });
    res.status(201).json({ success: true, conversation: conversation[0], created: true });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /messages/conversations/:id - Get messages, mark as read
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const conversations = await query('SELECT * FROM conversations WHERE id = :id', { id: req.params.id });
    if (conversations.length === 0) return res.status(404).json({ success: false, message: 'Conversation non trouvee' });

    const conv = conversations[0];
    if (conv.user1_id !== req.user.id && conv.user2_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acces refuse' });
    }

    // Get messages
    const messages = await query(
      'SELECT cm.*, u.first_name AS sender_first_name, u.last_name AS sender_last_name FROM conversation_messages cm LEFT JOIN users u ON u.id = cm.sender_id WHERE cm.conversation_id = :convId ORDER BY cm.created_at ASC',
      { convId: req.params.id }
    );

    // Mark messages from other user as read
    await sequelize.query(
      'UPDATE conversation_messages SET is_read = 1 WHERE conversation_id = :convId AND sender_id != :userId AND is_read = 0',
      { replacements: { convId: req.params.id, userId: req.user.id } }
    );

    res.json({ success: true, conversation: conv, messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /messages/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const conversations = await query('SELECT * FROM conversations WHERE id = :id', { id: req.params.id });
    if (conversations.length === 0) return res.status(404).json({ success: false, message: 'Conversation non trouvee' });

    const conv = conversations[0];
    if (conv.user1_id !== req.user.id && conv.user2_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acces refuse' });
    }

    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Le contenu est requis' });

    const [result] = await sequelize.query(
      'INSERT INTO conversation_messages (conversation_id, sender_id, content, is_read, created_at) VALUES (:convId, :senderId, :content, 0, NOW())',
      { replacements: { convId: req.params.id, senderId: req.user.id, content } }
    );

    // Update conversation last message
    const preview = content.length > 255 ? content.substring(0, 252) + '...' : content;
    await sequelize.query(
      'UPDATE conversations SET last_message = :preview, last_at = NOW() WHERE id = :id',
      { replacements: { id: req.params.id, preview } }
    );

    const messages = await query('SELECT * FROM conversation_messages WHERE id = :id', { id: result });
    res.status(201).json({ success: true, message: 'Message envoye', data: messages[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /messages/conversations/:id/read
router.put('/conversations/:id/read', requireAuth, async (req, res) => {
  try {
    await sequelize.query(
      'UPDATE conversation_messages SET is_read = 1 WHERE conversation_id = :convId AND sender_id != :userId AND is_read = 0',
      { replacements: { convId: req.params.id, userId: req.user.id } }
    );
    res.json({ success: true, message: 'Messages marques comme lus' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /messages/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM conversation_messages cm JOIN conversations c ON c.id = cm.conversation_id WHERE (c.user1_id = :userId OR c.user2_id = :userId) AND cm.sender_id != :userId AND cm.is_read = 0',
      { userId: req.user.id }
    );
    res.json({ success: true, unreadCount: result[0].count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
