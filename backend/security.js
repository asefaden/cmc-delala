const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { dbRun } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'cmc-delal-super-secret-key-development-2026';

// 1. Audit Log Helper
async function logSecurityEvent(eventType, userId, ipAddress, details) {
  try {
    await dbRun(
      `INSERT INTO security_logs (event_type, user_id, ip_address, details) VALUES (?, ?, ?, ?)`,
      [eventType, userId, ipAddress, details]
    );
  } catch (err) {
    console.error("Failed to write to audit log:", err);
  }
}

// 2. Token generation
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      verified: user.verified,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// 3. Authenticate Middleware
function authenticate(req, res, next) {
  let token = req.cookies.token;
  
  // Fallback to Bearer token header if client does not support cookie-based sessions
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Authentication token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }
}

// 4. Role Authorization Middleware
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logSecurityEvent(
        'unauthorized_access_attempt',
        req.user ? req.user.id : null,
        req.ip,
        `Attempted access to [${req.method}] ${req.originalUrl} without required role. Has: ${req.user ? req.user.role : 'anonymous'}, Needs: ${roles.join(',')}`
      );
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// 5. Input Sanitizer Middleware (Prevention against XSS)
function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  // Skip sanitization for URLs to prevent breaking avatar/image links
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/')) return str;
  // Skip already-encoded strings to prevent double-encoding
  if (str.includes('\u0026amp;') || str.includes('\u0026lt;') || str.includes('\u0026#x27;')) return str;
  // Encode dangerous HTML characters
  let result = str;
  result = result.replace(/&/g, '\u0026amp;');
  result = result.replace(/</g, '\u0026lt;');
  result = result.replace(/>/g, '\u0026gt;');
  result = result.replace(/"/g, '\u0026quot;');
  result = result.replace(/'/g, '\u0026#x27;');
  return result;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeText(obj[key]);
        } else if (obj[key] !== null && typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
}

// 6. Validation Helpers
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validates and normalizes Ethiopian phone numbers to "+2519xxxxxxxx" or "+2517xxxxxxxx"
function validateAndNormalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  // Remove spaces, hyphens, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Format check: +251 9... / +251 7...
  if (cleaned.startsWith('+251')) {
    return /^\+251[79]\d{8}$/.test(cleaned) ? cleaned : null;
  }
  
  // Format check: 251 9... / 251 7...
  if (cleaned.startsWith('251')) {
    return /^251[79]\d{8}$/.test(cleaned) ? '+' + cleaned : null;
  }
  
  // Format check: 09... / 07...
  if (cleaned.startsWith('0')) {
    return /^0[79]\d{8}$/.test(cleaned) ? '+251' + cleaned.substring(1) : null;
  }
  
  // Format check: 9... / 7...
  if (/^[79]\d{8}$/.test(cleaned)) {
    return '+251' + cleaned;
  }
  
  return null;
}

// 7. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 register/login requests per windowMs
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Limit each IP to 100 API requests per windowMs
  message: { error: 'Too many API requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  logSecurityEvent,
  generateToken,
  authenticate,
  authorizeRoles,
  sanitizeText,
  sanitizeBody,
  validateEmail,
  validateAndNormalizePhone,
  authLimiter,
  apiLimiter
};
