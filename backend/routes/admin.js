const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { 
  authenticate, 
  authorizeRoles, 
  sanitizeBody, 
  logSecurityEvent 
} = require('../security');

// Apply sanitization middleware
router.use(sanitizeBody);

// Protect all admin endpoints
router.use(authenticate, authorizeRoles('admin'));

// 1. Get all verification requests (with user information)
router.get('/verifications', async (req, res) => {
  try {
    const requests = await dbAll(`
      SELECT vr.*, u.full_name, u.email, u.phone, u.verified
      FROM verification_requests vr
      JOIN users u ON vr.user_id = u.id
      ORDER BY vr.created_at DESC
    `);
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Approve or Reject a verification request
router.post('/verifications/:id/resolve', async (req, res) => {
  const { status, notes } = req.body;
  const requestId = req.params.id;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status is required and must be either "approved" or "rejected".' });
  }

  try {
    const request = await dbGet("SELECT * FROM verification_requests WHERE id = ?", [requestId]);
    if (!request) {
      return res.status(404).json({ error: 'Verification request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been resolved.' });
    }

    // Resolve transactionally
    const verifiedValue = status === 'approved' ? 1 : 0;
    
    // Begin "transaction" via serialize/promise sequences
    await dbRun(`
      UPDATE verification_requests 
      SET status = ?, notes = ?
      WHERE id = ?
    `, [status, notes || null, requestId]);

    await dbRun(`
      UPDATE users 
      SET verified = ?
      WHERE id = ?
    `, [verifiedValue, request.user_id]);

    await logSecurityEvent(
      `broker_verification_${status}`, 
      req.user.id, 
      req.ip, 
      `Admin resolved verification request ID ${requestId} for User ID ${request.user_id} as ${status}.`
    );

    return res.json({ success: true, message: `Verification request has been ${status}.` });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. Get all Security Audit Logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT sl.*, u.email as user_email, u.role as user_role
      FROM security_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      ORDER BY sl.created_at DESC
      LIMIT 100
    `);
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. Toggle User suspension
router.post('/users/:id/suspend', async (req, res) => {
  const { status } = req.body; // 'active' or 'suspended'
  const targetUserId = req.params.id;
  
  if (!status || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or suspended.' });
  }

  if (Number(targetUserId) === req.user.id) {
    return res.status(400).json({ error: 'You cannot suspend yourself!' });
  }

  try {
    const targetUser = await dbGet("SELECT id, email, role FROM users WHERE id = ?", [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({ error: 'System administrators cannot be suspended through this API.' });
    }

    await dbRun("UPDATE users SET status = ? WHERE id = ?", [status, targetUserId]);
    
    await logSecurityEvent(
      `user_${status}`, 
      req.user.id, 
      req.ip, 
      `Admin changed User ID ${targetUserId} status to ${status}.`
    );

    return res.json({ success: true, message: `User account is now ${status}.` });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 5. Get Users list (for admin dashboard oversight)
router.get('/users', async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT id, email, full_name, phone, role, status, verified, telegram_username, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 6. Get all reviews (for admin oversight)
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, 
             b.full_name as broker_name, b.email as broker_email, b.avatar as broker_avatar,
             c.full_name as client_name, c.email as client_email, c.avatar as client_avatar
      FROM reviews r
      JOIN users b ON r.broker_id = b.id
      JOIN users c ON r.client_id = c.id
      ORDER BY r.created_at DESC
    `);
    return res.json(reviews);
  } catch (err) {
    console.error("Error fetching all reviews for admin:", err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
