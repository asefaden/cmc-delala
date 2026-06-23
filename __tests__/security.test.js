/**
 * Tests for backend security utility functions.
 * Covers: email validation, phone normalization, text sanitization,
 * JWT token generation, and authentication/authorization middleware.
 */

// Mock the database module before requiring security.js
jest.mock('../backend/database', () => ({
  dbRun: jest.fn(),
  dbGet: jest.fn(),
  dbAll: jest.fn(),
}));

const {
  validateEmail,
  validateAndNormalizePhone,
  sanitizeText,
  sanitizeBody,
  generateToken,
  authenticate,
  softAuthenticate,
  authorizeRoles,
} = require('../backend/security');

const jwt = require('jsonwebtoken');

// ─── validateEmail ───────────────────────────────────────────────
describe('validateEmail', () => {
  test('accepts valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co')).toBe(true);
    expect(validateEmail('a+b@c.com')).toBe(true);
    expect(validateEmail('name@company.org')).toBe(true);
  });

  test('rejects invalid email addresses', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user @domain.com')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
  });

  test('rejects non-string inputs', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(123)).toBe(false);
  });

  test('rejects emails longer than 254 characters', () => {
    const longLocal = 'a'.repeat(250);
    expect(validateEmail(`${longLocal}@domain.com`)).toBe(false);
  });
});

// ─── validateAndNormalizePhone ───────────────────────────────────
describe('validateAndNormalizePhone', () => {
  test('normalizes Ethiopian mobile numbers with +251 prefix', () => {
    expect(validateAndNormalizePhone('+251911223344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('+251711223344')).toBe('+251711223344');
  });

  test('normalizes numbers starting with 251 (no +)', () => {
    expect(validateAndNormalizePhone('251911223344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('251711223344')).toBe('+251711223344');
  });

  test('normalizes numbers starting with 0', () => {
    expect(validateAndNormalizePhone('0911223344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('0711223344')).toBe('+251711223344');
  });

  test('normalizes bare 10-digit numbers', () => {
    expect(validateAndNormalizePhone('911223344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('711223344')).toBe('+251711223344');
  });

  test('handles numbers with spaces, dashes, and parentheses', () => {
    expect(validateAndNormalizePhone('+251 911 223 344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('0911-223-344')).toBe('+251911223344');
    expect(validateAndNormalizePhone('(091) 122-3344')).toBe('+251911223344');
  });

  test('rejects invalid numbers', () => {
    expect(validateAndNormalizePhone('')).toBe(null);
    expect(validateAndNormalizePhone(null)).toBe(null);
    expect(validateAndNormalizePhone('12345')).toBe(null);
    expect(validateAndNormalizePhone('+25191122334')).toBe(null); // too short
    expect(validateAndNormalizePhone('+2519112233445')).toBe(null); // too long
    expect(validateAndNormalizePhone('+251511223344')).toBe(null); // wrong carrier prefix
  });
});

// ─── sanitizeText ────────────────────────────────────────────────
describe('sanitizeText', () => {
  test('escapes HTML entities in regular text', () => {
    expect(sanitizeText('hello world')).toBe('hello world');
    expect(sanitizeText('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(sanitizeText('<script>alert("xss")</script>')).not.toContain('>');
  });

  test('preserves valid URLs', () => {
    expect(sanitizeText('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizeText('http://example.com')).toBe('http://example.com');
  });

  test('preserves safe local paths', () => {
    expect(sanitizeText('/images/photo.jpg')).toBe('/images/photo.jpg');
  });

  test('does not double-encode already encoded entities', () => {
    // A string that already contains encoded HTML entities (e.g. from a DB) should pass through unchanged
    const alreadyEncoded = String.fromCharCode(38) + 'amp; ' + String.fromCharCode(38) + 'lt; ' + String.fromCharCode(38) + 'gt; hello';
    expect(sanitizeText(alreadyEncoded)).toBe(alreadyEncoded);
  });

  test('returns non-string inputs unchanged', () => {
    expect(sanitizeText(42)).toBe(42);
    expect(sanitizeText(null)).toBe(null);
  });

  test('escapes quotes and ampersands', () => {
    const result = sanitizeText('foo & "bar" \'baz\'');
    expect(result).not.toContain('"');
    expect(result).not.toContain("'");
    expect(result).toContain('foo');
  });
});

// ─── sanitizeBody middleware ─────────────────────────────────────
describe('sanitizeBody middleware', () => {
  test('sanitizes string fields in req.body', () => {
    const req = {
      body: { name: '<b>evil</b>', title: 'normal' },
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.name).not.toContain('<b>');
    expect(req.body.title).toBe('normal');
  });

  test('sanitizes nested objects', () => {
    const req = {
      body: { nested: { text: '<img onerror=alert(1)>' } },
    };
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.nested.text).not.toContain('<img');
  });

  test('skips when body is undefined', () => {
    const req = {};
    const res = {};
    const next = jest.fn();

    sanitizeBody(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// ─── generateToken ──────────────────────────────────────────────
describe('generateToken', () => {
  test('generates a valid JWT token', () => {
    const user = { id: 1, role: 'broker' };
    const token = generateToken(user);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const decoded = jwt.decode(token);
    expect(decoded.id).toBe(1);
    expect(decoded.role).toBe('broker');
    expect(decoded.exp).toBeDefined();
  });

  test('token expires in 24 hours', () => {
    const user = { id: 2, role: 'client' };
    const token = generateToken(user);
    const decoded = jwt.decode(token);

    const now = Math.floor(Date.now() / 1000);
    const diff = decoded.exp - now;

    // Should expire roughly 24h from now (allow 10s tolerance)
    expect(diff).toBeGreaterThan(86390);
    expect(diff).toBeLessThanOrEqual(86400);
  });
});

// ─── authenticate middleware ─────────────────────────────────────
describe('authenticate middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('returns 401 when no token is provided', () => {
    const req = { cookies: {}, headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('token missing') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for invalid token', () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer invalid.token.here' },
    };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() with valid token in Authorization header', () => {
    const user = { id: 1, role: 'admin' };
    const token = generateToken(user);

    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(req.user.role).toBe('admin');
  });

  test('reads token from cookie when header is absent', () => {
    const user = { id: 3, role: 'client' };
    const token = generateToken(user);

    const req = {
      cookies: { token },
      headers: {},
    };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(3);
  });
});

// ─── softAuthenticate middleware ─────────────────────────────────
describe('softAuthenticate middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('sets req.user to null when no token is provided', () => {
    const req = { cookies: {}, headers: {} };
    const res = mockRes();
    const next = jest.fn();

    softAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
  });

  test('sets req.user to decoded token when valid', () => {
    const user = { id: 5, role: 'broker' };
    const token = generateToken(user);

    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    };
    const res = mockRes();
    const next = jest.fn();

    softAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(5);
  });

  test('sets req.user to null for invalid token (does not 401)', () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Bearer garbage' },
    };
    const res = mockRes();
    const next = jest.fn();

    softAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeNull();
    expect(res.status).not.toHaveBeenCalled(); // should NOT return 401
  });
});

// ─── authorizeRoles middleware ──────────────────────────────────
describe('authorizeRoles middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('calls next() when user has allowed role', () => {
    const req = { user: { id: 1, role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    authorizeRoles('admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when user role is not allowed', () => {
    const req = {
      user: { id: 2, role: 'client' },
      method: 'GET',
      originalUrl: '/api/admin',
      ip: '127.0.0.1',
    };
    const res = mockRes();
    const next = jest.fn();

    authorizeRoles('admin', 'broker')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Insufficient permissions') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when no user is set', () => {
    const req = {
      user: null,
      method: 'DELETE',
      originalUrl: '/api/listings/1',
      ip: '127.0.0.1',
    };
    const res = mockRes();
    const next = jest.fn();

    authorizeRoles('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('supports multiple allowed roles', () => {
    const req = { user: { id: 3, role: 'broker' } };
    const res = mockRes();
    const next = jest.fn();

    authorizeRoles('admin', 'broker')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});