const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { 
  authenticate, 
  authorizeRoles, 
  sanitizeBody, 
  logSecurityEvent 
} = require('../security');

// sanitizeBody is already applied globally in server.js — no duplicate needed here
console.log('[listings] router module loaded');

/**
 * 1. Get Listings (with advanced search and filter checks)
 */
router.get('/', async (req, res) => {
  console.log('[listings] GET /api/listings handler entered');
  try {
    console.log('GET /api/listings called with query:', req.query);

    const { category, type, location, minPrice, maxPrice, search } = req.query;
    
    let whereClause = "WHERE l.status = 'active'";
    const params = [];

    if (category) {
      whereClause += " AND l.category = ?";
      params.push(category);
    }
    if (type) {
      whereClause += " AND l.type = ?";
      params.push(type);
    }
    if (location) {
      whereClause += " AND l.location LIKE ?";
      params.push(`%${location}%`);
    }
    if (minPrice) {
      whereClause += " AND l.price >= ?";
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      whereClause += " AND l.price <= ?";
      params.push(Number(maxPrice));
    }
    if (search) {
      whereClause += " AND (l.title LIKE ? OR l.description LIKE ? OR l.location LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const query = `
      SELECT
        l.*,
        u.full_name as broker_name,
        u.phone as broker_phone,
        u.telegram_username as broker_telegram,
        u.verified as broker_verified,
        u.avatar as broker_avatar
      FROM listings l
      LEFT JOIN users u ON l.broker_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const listings = await dbAll(query, params);

    console.log('Listings fetched:', listings.length);

    const formattedListings = (listings || []).map(listing => {
      let images = [];
      try {
        images = listing.images ? JSON.parse(listing.images) : [];
      } catch (e) {
        console.error(`Failed to parse images for listing ${listing.id}:`, e.message);
      }
      return { ...listing, images };
    });

    res.json(formattedListings);

  } catch (err) {
    console.error('Listings route error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * 2. Get Single Listing
 */
router.get('/:id', async (req, res, next) => {
  try {
    const listing = await dbGet(`
      SELECT l.*, u.full_name as broker_name, u.phone as broker_phone, 
             u.telegram_username as broker_telegram, u.verified as broker_verified, 
             u.avatar as broker_avatar, u.bio as broker_bio
      FROM listings l
      LEFT JOIN users u ON l.broker_id = u.id
      WHERE l.id = ?
    `, [req.params.id]);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    try {
      listing.images = listing.images ? JSON.parse(listing.images) : [];
    } catch (e) {
      listing.images = [];
    }
    
    return res.json(listing);
  } catch (err) {
    console.error("Error fetching single listing:", err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 3. Create Listing (Brokers & Admins authorization checks)
 */
router.post('/', authenticate, authorizeRoles('broker', 'admin'), async (req, res, next) => {
  const { title, description, category, type, price, currency, location, images } = req.body;

  if (!title || !description || !category || !type || !price || !location) {
    return res.status(400).json({ error: 'Missing required fields (title, description, category, type, price, location).' });
  }

  if (isNaN(price) || Number(price) <= 0) {
    return res.status(400).json({ error: 'Price must be a valid positive number.' });
  }

  const validCategories = ['real_estate', 'vehicle', 'services'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category. Must be real_estate, vehicle, or services.' });
  }

  const validTypes = ['rent', 'sale', 'job'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Must be rent, sale, or job.' });
  }

  let imagesArray = [];
  if (images && Array.isArray(images)) {
    imagesArray = images;
  } else {
    if (category === 'real_estate') {
      imagesArray = ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'];
    } else if (category === 'vehicle') {
      imagesArray = ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'];
    } else {
      imagesArray = ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800'];
    }
  }

  try {
    const brokerId = req.user.id;

    const result = await dbRun(`
      INSERT INTO listings (broker_id, title, description, category, type, price, currency, location, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      brokerId, 
      title, 
      description, 
      category, 
      type, 
      Number(price), 
      currency || 'ETB', 
      location, 
      JSON.stringify(imagesArray)
    ]);

    await logSecurityEvent('listing_created', brokerId, req.ip, `Created listing: ${title} in ${location} with ID: ${result.id}`);

    return res.status(201).json({ 
      success: true, 
      listingId: result.id, 
      message: 'Listing published successfully!' 
    });
  } catch (err) {
    console.error("Error creating listing:", err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 4. Update Listing (Owner broker or Admin access checks)
 */
router.put('/:id', authenticate, authorizeRoles('broker', 'admin'), async (req, res, next) => {
  const { title, description, category, type, price, currency, location, images, status } = req.body;

  try {
    const listing = await dbGet("SELECT * FROM listings WHERE id = ?", [req.params.id]);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (req.user.role === 'broker' && listing.broker_id !== req.user.id) {
      await logSecurityEvent('unauthorized_listing_edit_attempt', req.user.id, req.ip, `Broker attempted to edit listing ID ${req.params.id} owned by broker ID ${listing.broker_id}`);
      return res.status(403).json({ error: 'Access denied. You do not own this listing.' });
    }

    const updatedTitle = title || listing.title;
    const updatedDesc = description || listing.description;
    const updatedCat = category || listing.category;
    const updatedType = type || listing.type;
    const updatedPrice = price !== undefined ? Number(price) : listing.price;
    const updatedCurrency = currency || listing.currency;
    const updatedLoc = location || listing.location;
    const updatedImages = images ? JSON.stringify(images) : listing.images;
    const updatedStatus = status || listing.status;

    await dbRun(`
      UPDATE listings 
      SET title = ?, description = ?, category = ?, type = ?, price = ?, currency = ?, location = ?, images = ?, status = ?
      WHERE id = ?
    `, [updatedTitle, updatedDesc, updatedCat, updatedType, updatedPrice, updatedCurrency, updatedLoc, updatedImages, updatedStatus, req.params.id]);

    await logSecurityEvent('listing_updated', req.user.id, req.ip, `Updated listing ID ${req.params.id}: ${updatedTitle}`);

    return res.json({ success: true, message: 'Listing updated successfully.' });
  } catch (err) {
    console.error("Error updating listing:", err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 5. Delete Listing
 */
router.delete('/:id', authenticate, authorizeRoles('broker', 'admin'), async (req, res, next) => {
  try {
    const listing = await dbGet("SELECT * FROM listings WHERE id = ?", [req.params.id]);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (req.user.role === 'broker' && listing.broker_id !== req.user.id) {
      await logSecurityEvent('unauthorized_listing_delete_attempt', req.user.id, req.ip, `Broker attempted to delete listing ID ${req.params.id} owned by broker ID ${listing.broker_id}`);
      return res.status(403).json({ error: 'Access denied. You do not own this listing.' });
    }

    await dbRun("DELETE FROM listings WHERE id = ?", [req.params.id]);
    await logSecurityEvent('listing_deleted', req.user.id, req.ip, `Deleted listing ID ${req.params.id}: ${listing.title}`);

    return res.json({ success: true, message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error("Error deleting listing:", err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;