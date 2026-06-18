const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { 
  authenticate, 
  authorizeRoles, 
  sanitizeBody, 
  logSecurityEvent 
} = require('../security');

router.use(sanitizeBody);

// 1. Get Brokers Directory (with average ratings and active listings count)
router.get('/', async (req, res) => {
  try {
    const brokers = await dbAll(`
      SELECT u.id, u.full_name, u.phone, u.telegram_username, u.verified, u.bio, u.avatar, u.created_at,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(DISTINCT r.id) as review_count,
             (SELECT COUNT(*) FROM listings WHERE broker_id = u.id AND status = 'active') as active_listings_count
      FROM users u
      LEFT JOIN reviews r ON u.id = r.broker_id
      WHERE u.role = 'broker' AND u.status = 'active'
      GROUP BY u.id
      ORDER BY u.verified DESC, rating_avg DESC
    `);

    return res.json(brokers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Get Broker Details (including lists of their active listings and reviews)
router.get('/:id', async (req, res) => {
  const brokerId = req.params.id;
  try {
    const broker = await dbGet(`
      SELECT id, full_name, email, phone, telegram_username, verified, bio, avatar, created_at,
             (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE broker_id = ?) as rating_avg,
             (SELECT COUNT(*) FROM reviews WHERE broker_id = ?) as review_count
      FROM users
      WHERE id = ? AND role = 'broker' AND status = 'active'
    `, [brokerId, brokerId, brokerId]);

    if (!broker) {
      return res.status(404).json({ error: 'Broker not found.' });
    }

    // Get active listings for this broker
    const listings = await dbAll("SELECT * FROM listings WHERE broker_id = ? AND status = 'active' ORDER BY created_at DESC", [brokerId]);
    const formattedListings = listings.map(l => ({
      ...l,
      images: l.images ? JSON.parse(l.images) : []
    }));

    // Get reviews for this broker
    const reviews = await dbAll(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as client_name, u.avatar as client_avatar
      FROM reviews r
      JOIN users u ON r.client_id = u.id
      WHERE r.broker_id = ?
      ORDER BY r.created_at DESC
    `, [brokerId]);

    return res.json({
      broker,
      listings: formattedListings,
      reviews
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. Submit Review on a Broker
router.post('/:id/reviews', authenticate, async (req, res) => {
  const brokerId = req.params.id;
  const clientId = req.user.id;
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    return res.status(400).json({ error: 'Rating (1-5) and comment are required.' });
  }

  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  // 1. Prevent self-review
  if (clientId === Number(brokerId)) {
    return res.status(400).json({ error: 'You cannot review yourself.' });
  }

  try {
    // 2. Validate that target user exists and is a broker
    const targetUser = await dbGet("SELECT role, status FROM users WHERE id = ?", [brokerId]);
    if (!targetUser || targetUser.role !== 'broker' || targetUser.status !== 'active') {
      return res.status(404).json({ error: 'Active broker not found.' });
    }

    // 3. Insert or update review (Client can only have one review per broker)
    await dbRun(`
      INSERT INTO reviews (broker_id, client_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP
    `, [brokerId, clientId, numericRating, comment]);

    await logSecurityEvent('broker_review_added_or_updated', clientId, req.ip, `Client ID ${clientId} left/updated a rating of ${numericRating} for Broker ID ${brokerId}`);

    return res.json({ success: true, message: 'Review submitted successfully.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. Broker submits a verification request
router.post('/apply/verify', authenticate, authorizeRoles('broker'), async (req, res) => {
  const { id_type, id_number, document_path } = req.body;
  const userId = req.user.id;

  if (!id_type || !id_number) {
    return res.status(400).json({ error: 'ID Type and ID Number are required.' });
  }

  try {
    // Check if user is already verified
    const user = await dbGet("SELECT verified FROM users WHERE id = ?", [userId]);
    if (user && user.verified === 1) {
      return res.status(400).json({ error: 'You are already a verified broker.' });
    }

    // Check if there is an active pending request
    const pendingRequest = await dbGet(`
      SELECT id FROM verification_requests 
      WHERE user_id = ? AND status = 'pending'
    `, [userId]);

    if (pendingRequest) {
      return res.status(400).json({ error: 'You already have a pending verification request.' });
    }

    // Create a request
    await dbRun(`
      INSERT INTO verification_requests (user_id, id_type, id_number, document_path)
      VALUES (?, ?, ?, ?)
    `, [userId, id_type, id_number, document_path || 'simulated_upload_document.pdf']);

    await logSecurityEvent('broker_verification_requested', userId, req.ip, `Broker ID ${userId} submitted a verification request: type ${id_type}, ID num ${id_number}`);

    return res.status(201).json({ 
      success: true, 
      message: 'Verification request submitted successfully. An administrator will review your credentials.' 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
