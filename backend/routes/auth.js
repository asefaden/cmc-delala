const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbGet, dbRun } = require('../database');
const { 
  generateToken, 
  authenticate,
  softAuthenticate, 
  sanitizeBody, 
  validateEmail, 
  validateAndNormalizePhone, 
  logSecurityEvent,
  authLimiter
} = require('../security');

// --- Multer Setup for Avatar Uploads ---
const uploadDir = path.join(__dirname, '..', 'uploads');

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatar_user${req.user.id}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // Max 3MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase())
                 && allowedTypes.test(file.mimetype);
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed.'));
    }
  }
});

// 1. User Registration
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, full_name, phone, role, telegram_username, bio } = req.body;

  // Validate fields
  if (!email || !password || !full_name || !phone || !role) {
    return res.status(400).json({ error: 'All fields (email, password, full_name, phone, role) are required.' });
  }

  // Validate Email
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  // Validate Password Strength (min 8 chars, must contain numbers/letters)
  if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain both letters and numbers.' });
  }

  // Validate Role
  if (role !== 'client' && role !== 'broker') {
    return res.status(400).json({ error: 'Role must be either "client" or "broker". Registration as Admin is forbidden.' });
  }

  // Validate and Normalize Phone
  const normalizedPhone = validateAndNormalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Invalid Ethiopian phone number. Please use +251..., 251..., 09..., or 07...' });
  }

  try {
    // Check if email already registered
    const existingUser = await dbGet("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existingUser) {
      await logSecurityEvent('registration_failed_duplicate_email', null, req.ip, `Email registration attempt for already existing: ${email}`);
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user into DB
    const avatar = role === 'broker' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' 
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
      
    const result = await dbRun(`
      INSERT INTO users (email, password_hash, full_name, phone, role, verified, telegram_username, bio, avatar)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [email.toLowerCase(), passwordHash, full_name, normalizedPhone, role, telegram_username || null, bio || null, avatar]);

    await logSecurityEvent('user_register_success', result.id, req.ip, `Registered new user: ${email} as role: ${role}`);

    return res.status(201).json({ 
      success: true, 
      message: 'Registration successful! You can now log in.' 
    });

  } catch (err) {
    console.error(err);
    await logSecurityEvent('user_register_error', null, req.ip, `Internal error during registration: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. User Login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if user exists
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) {
      // Return generic error for security
      await logSecurityEvent('login_failed_invalid_user', null, req.ip, `Failed login attempt for non-existent email: ${email}`);
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Check if suspended
    if (user.status === 'suspended') {
      await logSecurityEvent('login_failed_suspended', user.id, req.ip, `Suspended user: ${email} tried to log in.`);
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await logSecurityEvent('login_failed_wrong_password', user.id, req.ip, `Failed login attempt (wrong password) for: ${email}`);
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = generateToken(user);

    // Save in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    await logSecurityEvent('login_success', user.id, req.ip, `User successfully logged in: ${email}`);

    // Return profile data (exclude sensitive details)
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        verified: user.verified,
        telegram_username: user.telegram_username,
        bio: user.bio,
        avatar: user.avatar
      }
    });

  } catch (err) {
    console.error(err);
    await logSecurityEvent('login_error', null, req.ip, `Internal error during login: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. User Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 4. Get Current Profile (soft-auth: returns null user instead of 401 when not logged in)
router.get('/profile', softAuthenticate, async (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  try {
    const user = await dbGet("SELECT id, email, full_name, phone, role, verified, telegram_username, bio, avatar, created_at FROM users WHERE id = ?", [req.user.id]);
    if (!user) {
      return res.json({ user: null });
    }
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 5. Update Profile
router.put('/profile', authenticate, async (req, res) => {
  const { full_name, phone, telegram_username, bio, avatar } = req.body;

  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Full name and phone number are required.' });
  }

  const normalizedPhone = validateAndNormalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Invalid Ethiopian phone number. Please use +251..., 251..., 09..., or 07...' });
  }

  console.log(`User ${req.user.id} attempting to update profile with data:`, { full_name, normalizedPhone, telegram_username, bio, avatar });

  try {
    await dbRun(`
      UPDATE users 
      SET full_name = ?, phone = ?, telegram_username = ?, bio = ?, avatar = ?
      WHERE id = ?
    `, [full_name, normalizedPhone, telegram_username || null, bio || null, avatar || null, req.user.id]);

    console.log(`Profile update successful for user ${req.user.id}.`);
    await logSecurityEvent('profile_update', req.user.id, req.ip, 'User updated profile details.');

    // Fetch and return the updated user
    const updatedUser = await dbGet("SELECT id, email, full_name, phone, role, verified, telegram_username, bio, avatar FROM users WHERE id = ?", [req.user.id]);
    if (!updatedUser) {
      console.error(`Failed to fetch updated user ${req.user.id} after successful update.`);
    }
    return res.json({ success: true, user: updatedUser });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 6. Upload Avatar Photo
router.post(
  '/upload-avatar',
  authenticate,
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Image too large. Maximum size is 3MB.' });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was uploaded.' });
    }

    // Delete old avatar file if it was a local upload
    try {
      const user = await dbGet('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
      if (user && user.avatar && user.avatar.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } catch (_) {}

    // Build the public URL for the new avatar
    const avatarUrl = `/uploads/${req.file.filename}`;

    try {
      await dbRun('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);
      await logSecurityEvent('avatar_upload', req.user.id, req.ip, `User uploaded new avatar: ${req.file.filename}`);

      const updatedUser = await dbGet(
        'SELECT id, email, full_name, phone, role, verified, telegram_username, bio, avatar FROM users WHERE id = ?',
        [req.user.id]
      );

      return res.json({ success: true, avatarUrl, user: updatedUser });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error while saving avatar.' });
    }
  }
);

module.exports = router;
