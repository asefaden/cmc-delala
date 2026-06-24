const express = require('express');
const router = express.Router();
const { dbGet, dbRun, dbAll } = require('../database');
const { authenticate, softAuthenticate } = require('../security');

// 1. User: Send a message (creates conversation if needed)
router.post('/send', softAuthenticate, async (req, res) => {
  const { message, conversation_id } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in to send messages.' });
  }

  try {
    let convId = conversation_id;

    // If no conversation_id provided, find or create one for this user
    if (!convId) {
      const existing = await dbGet(
        "SELECT id FROM chat_conversations WHERE user_id = ? AND status = 'open' ORDER BY updated_at DESC LIMIT 1",
        [req.user.id]
      );
      if (existing) {
        convId = existing.id;
      } else {
        const conv = await dbRun(
          "INSERT INTO chat_conversations (user_id, status) VALUES (?, 'open')",
          [req.user.id]
        );
        convId = conv.id;
      }
    } else {
      // Verify the conversation belongs to this user
      const conv = await dbGet(
        "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?",
        [convId, req.user.id]
      );
      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
    }

    // Insert the message
    const msgResult = await dbRun(
      "INSERT INTO chat_messages (conversation_id, sender_id, message, is_admin_reply) VALUES (?, ?, ?, 0)",
      [convId, req.user.id, message.trim()]
    );

    // Update conversation timestamp
    await dbRun(
      "UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?",
      [convId]
    );

    return res.status(201).json({
      success: true,
      conversation_id: convId,
      message: {
        id: msgResult.id,
        conversation_id: convId,
        sender_id: req.user.id,
        message: message.trim(),
        is_admin_reply: false,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. User: Get their conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await dbAll(
      `SELECT c.*, 
        (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND is_admin_reply = 1 AND sender_id IS NOT NULL) as unread_count
       FROM chat_conversations c 
       WHERE c.user_id = ? 
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    return res.json({ conversations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. User: Get messages in a conversation
router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const conversation = await dbGet(
      "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await dbAll(
      `SELECT m.*, u.full_name as sender_name, u.avatar as sender_avatar
       FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    return res.json({ messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. User: Close a conversation
router.put('/conversations/:id/close', authenticate, async (req, res) => {
  try {
    const conversation = await dbGet(
      "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await dbRun(
      "UPDATE chat_conversations SET status = 'closed' WHERE id = ?",
      [req.params.id]
    );

    return res.json({ success: true, message: 'Conversation closed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// 5. Admin: Get all conversations
router.get('/admin/conversations', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const conversations = await dbAll(
      `SELECT c.*, 
        u.full_name as user_name,
        u.email as user_email,
        u.avatar as user_avatar,
        (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND is_admin_reply = 0) as user_message_count,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND is_admin_reply = 1) as admin_message_count
       FROM chat_conversations c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.updated_at DESC`
    );
    return res.json({ conversations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 6. Admin: Get messages in a conversation
router.get('/admin/conversations/:id/messages', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    const messages = await dbAll(
      `SELECT m.*, u.full_name as sender_name, u.avatar as sender_avatar, u.role as sender_role
       FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    return res.json({ messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 7. Admin: Reply to a conversation
router.post('/admin/reply', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { conversation_id, message } = req.body;

  if (!conversation_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'Conversation ID and message are required.' });
  }

  try {
    const conversation = await dbGet(
      "SELECT id FROM chat_conversations WHERE id = ?",
      [conversation_id]
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const msgResult = await dbRun(
      "INSERT INTO chat_messages (conversation_id, sender_id, message, is_admin_reply) VALUES (?, ?, ?, 1)",
      [conversation_id, req.user.id, message.trim()]
    );

    await dbRun(
      "UPDATE chat_conversations SET updated_at = NOW() WHERE id = ?",
      [conversation_id]
    );

    return res.status(201).json({
      success: true,
      message: {
        id: msgResult.id,
        conversation_id,
        sender_id: req.user.id,
        message: message.trim(),
        is_admin_reply: true,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 8. Admin: Close a conversation
router.put('/admin/conversations/:id/close', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    await dbRun(
      "UPDATE chat_conversations SET status = 'closed' WHERE id = ?",
      [req.params.id]
    );
    return res.json({ success: true, message: 'Conversation closed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 9. Admin: Reopen a conversation
router.put('/admin/conversations/:id/reopen', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  try {
    await dbRun(
      "UPDATE chat_conversations SET status = 'open' WHERE id = ?",
      [req.params.id]
    );
    return res.json({ success: true, message: 'Conversation reopened.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;