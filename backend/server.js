// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

// STRICT CHECK: Must run BEFORE require('./security') which validates JWT_SECRET on load
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('development')) {
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║  STARTUP DIAGNOSTICS                                     ║');
    console.error('╠════════════════════════════════════════════════════════════╣');
    console.error('║  FATAL: JWT_SECRET is missing or uses a development      ║');
    console.error('║  default. Set a secure JWT_SECRET in your platform       ║');
    console.error('║  environment variables.                                  ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('Required env vars: JWT_SECRET, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    console.error('Set these in your alecloud deployment dashboard.');
    process.exit(1);
  }
} else {
  // Safe fallback ONLY for local development
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret_only_for_local';
}

const { initDb } = require('./database');
const { apiLimiter, logSecurityEvent, sanitizeBody } = require('./security');
const app = express();
const PORT = process.env.PORT || 3000; 

// Variables tracking operational health
let isDbConnected = false;
let isStarting = true;

// 1. Health check – always 200 once the server is listening so the
//    platform reverse-proxy never shows "Bad Gateway" during normal operation.
app.get('/health', (_req, res) => {
  const dbOk = isDbConnected;
  const status = isStarting ? 'starting' : (dbOk ? 'ok' : 'degraded');
  res.status(200).json({
    status,
    database: dbOk ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Root – lightweight landing that confirms the service is alive
app.get('/', (_req, res) => {
  res.json({
    name: 'CMC Delal Backend',
    version: '1.0.0',
    status: isStarting ? 'starting' : 'ok',
    health: '/health'
  });
});

// 2. Frontend configuration endpoint
app.get('/config', (req, res) => {
  const raw = (process.env.API_BASE_URL || '').trim();
  res.json({ apiBaseUrl: raw || '' });
});

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://assets.unsplash.com"],
      connectSrc: [
        "'self'", 
        "http://localhost:5173",
        "https://localhost:5173",
        "http://localhost:3000",
        "https://aletcloud.com", 
        "https://cdn.jsdelivr.net"
      ]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS Configuration
const corsRaw = (process.env.FRONTEND_URL || '').trim();
let corsOrigins = corsRaw
  ? corsRaw.split(',').map(o => o.trim()).filter(Boolean)
  : [];

if (process.env.NODE_ENV !== 'production' && corsOrigins.length === 0) {
  corsOrigins.push('http://localhost:5173', 'https://localhost:5173', 'http://localhost:3000');
}

corsOrigins = corsOrigins.filter(origin => origin !== '*');
if (corsOrigins.length === 0) {
  corsOrigins = ['http://localhost:5173', 'https://localhost:5173', 'http://localhost:3000', 'https://delalaapp.app.aletcloud.com'];
}

const corsOptions = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

if (corsOrigins.length === 1) {
  corsOptions.origin = corsOrigins[0];
} else {
  corsOptions.origin = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  };
}

app.use(cors(corsOptions));

// Standard Parsers & Sanitization
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeBody);

// Apply global API rate limiter
app.use('/api/', apiLimiter);

// Redirect typos
app.use('/lisintgs', (req, res) => {
  res.redirect(301, '/api/listings' + (req.path || ''));
});
app.use('/listings', (req, res) => {
  res.redirect(301, '/api/listings' + (req.path || ''));
});

// --- Mount Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/admin', require('./routes/admin'));

// FIXED: Mount listings route natively using a lightweight tracking middleware sequence
const listingsRouter = require('./routes/listings');
app.use('/api/listings', (req, res, next) => {
  req.isListingsRequest = true;
  next(); 
}, listingsRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 404 handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Serve Frontend (React SPA) ---
const frontendDist = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')       
  : path.join(__dirname, '..', 'dist'); 

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  console.warn('  ⚠ Frontend dist/ folder not found at:', frontendDist);
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Frontend not built. Run npm run build.' });
  });
}

// Enhanced error handler for listings route (Now completely reachable!)
app.use('/api/listings', (err, req, res, next) => {
  console.error('Listings error boundary caught:', err);
  
  const userId = req.user ? req.user.id : null;
  const errorType = err.message.toLowerCase().includes('database') ? 'database_error' : 'listings_error';
  
  logSecurityEvent(errorType, userId, req.ip, `Listings error: ${err.message}`)
    .catch(console.error);

  if (err.message.includes('not found') || err.message.includes('no listings')) {
    return res.status(404).json({
      error: 'No listings found',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.message.includes('validation') || err.message.includes('invalid')) {
    return res.status(400).json({
      error: 'Invalid request',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  if (err.message.toLowerCase().includes('database') || err.message.includes('connection') || err.message.includes('pool')) {
    return res.status(503).json({
      error: 'Database unavailable',
      details: 'Unable to process data operation cleanly right now.',
      timestamp: new Date().toISOString()
    });
  }
  
  return res.status(500).json({
    error: 'Listings service error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler (Fallback stack wrapper)
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  
  logSecurityEvent('server_error', req.user ? req.user.id : null, req.ip, `Unhandled error: ${err.message}`)
    .catch(console.error);

  if (req.isListingsRequest) {
    return res.status(500).json({
      error: 'Listings service unavailable',
      timestamp: new Date().toISOString()
    });
  }

  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Graceful Process Interception
process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown on SIGTERM / SIGINT
const { getPool } = require('./database');
let _server = null;

function gracefulShutdown(signal) {
  console.log(`\n⚠  ${signal} received – shutting down gracefully…`);
  if (_server) {
    _server.close(() => {
      console.log('  ✓ HTTP server closed');
      const pool = getPool();
      if (pool) {
        pool.end().then(() => {
          console.log('  ✓ Database pool closed');
          process.exit(0);
        }).catch(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  }
  setTimeout(() => {
    console.error('  ✗ Forced shutdown after timeout');
    process.exit(1);
  }, 8000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Bootstrap Server Setup
async function startServer() {
  const uploadDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("Upload directory initialized.");
    }
  } catch (err) {
    console.warn("WARNING: Could not create upload directory via code:", err.message);
  }

  console.log('\n--- Environment Check ---');
  console.log(`  NODE_ENV:      ${process.env.NODE_ENV || '(not set — defaults to development)'}`);
  console.log(`  PORT:          ${PORT}`);
  console.log(`  JWT_SECRET:    ${process.env.JWT_SECRET ? '✓ set' : '✗ MISSING'}`);
  console.log(`  DB_HOST:       ${process.env.DB_HOST || '✗ MISSING'}`);
  console.log(`  DB_PORT:       ${process.env.DB_PORT || '3306 (default)'}`);
  console.log(`  DB_NAME:       ${process.env.DB_NAME || '✗ MISSING'}`);
  console.log(`  DB_USER:       ${process.env.DB_USER || '✗ MISSING'}`);
  console.log(`  DB_PASSWORD:   ${process.env.DB_PASSWORD ? '✓ set' : '✗ MISSING'}`);
  console.log(`  FRONTEND_URL:  ${process.env.FRONTEND_URL || '(not set)'}`);
  console.log('--- End Environment Check ---\n');

  try {
    await initDb();
    isDbConnected = true;
    console.log('  ✓ Database: Connected & schema ready');
  } catch (err) {
    console.error('  ✗ Database: FAILED —', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    console.warn('  Running in development fallback mode without DB...');
  }

  _server = app.listen(PORT, '0.0.0.0', () => {
    isStarting = false;
    const env = process.env.NODE_ENV || 'development';
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          ሲኤምሲ ደላላ (CMC Delal) Backend                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Status:    ✓ Running                                    ║`);
    console.log(`║  Env:       ${env.padEnd(45)}║`);
    console.log(`║  URL:       ${('http://localhost:' + PORT).padEnd(45)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  });

  _server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${PORT} is already in use.`);
    } else {
      console.error('FATAL: Server error:', err);
    }
    process.exit(1);
  });
}

startServer();