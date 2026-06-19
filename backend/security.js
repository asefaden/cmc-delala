const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { dbRun } = require('./database');

// CRITICAL: Ensure you do not leave a fallback secret string evaluated in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is missing.');
}

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

// 2. Token generation (Optimized payload to avoid token bloat and stale data)
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role 
    },
    JWT_SECRET || 'cmc-delal-super-secret-key-development-2026',
    { expiresIn: '24h' }
  );
}

// 3. Authenticate Middleware
function authenticate(req, res, next) {
  let token = req.cookies.token;
  
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
    const decoded = jwt.verify(token, JWT_SECRET || 'cmc-delal-super-secret-key-development-2026');
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

// 5. Input Sanitizer Middleware (Secure Context HTML Entity Encoding)
function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  
  // Safely check if it's a URL structure WITHOUT dropping validation on trailing malicious injection strings
  let isPlainUrl = false;
  try {
    const parsed = new URL(str);
    // Only trust standard web protocols with no embedded markup signals
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !str.includes('<') && !str.includes('>')) {
      isPlainUrl = true;
    }
  } catch (_) {
    // If it fails parsing as a full URL, check if it's a local root static file path safely
    if (str.startsWith('/') && !str.includes('..') && !str.includes('<') && !str.includes('>')) {
      isPlainUrl = true;
    }
  }

  if (isPlainUrl) return str;
  if (str.includes('\u0026amp;') || str.includes('\u0026lt;') || str.includes('\u0026#x27;')) return str;

  return str
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026#x27;');
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

// 6. Secure Validation Helpers
function validateEmail(email) {
  if (!email || typeof email !== 'string' || email.length > 254) return false;
  // A clean, simple, production-standard check that completely mitigates catastrophic backtracking (ReDoS)
  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return simpleEmailRegex.test(email);
}

// Validates and normalizes Ethiopian phone numbers to "+2519xxxxxxxx" or "+2517xxxxxxxx"
function validateAndNormalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+251')) {
    return /^\+251[79]\d{8}$/.test(cleaned) ? cleaned : null;
  }
  if (cleaned.startsWith('251')) {
    return /^251[79]\d{8}$/.test(cleaned) ? '+' + cleaned : null;
  }
  if (cleaned.startsWith('0')) {
    return /^0[79]\d{8}$/.test(cleaned) ? '+251' + cleaned.substring(1) : null;
  }
  if (/^[79]\d{8}$/.test(cleaned)) {
    return '+251' + cleaned;
  }
  
  return null;
}

// 7. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
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