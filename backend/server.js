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
    console.error('Set these in your cloud deployment dashboard.');
    process.exit(1);
  }
} else {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret_only_for_local';
}

const { initDb, getPool } = require('./database');
const { apiLimiter, logSecurityEvent, sanitizeBody } = require('./security');
const app = express();
const PORT = process.env.PORT || 3000; 

let isDbConnected = false;
let isStarting = true;

// 1. Health check 
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
let corsOrigins = corsRaw ? corsRaw.split(',').map(o => o.trim()).filter(Boolean) : [];

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
  origin: corsOrigins.length === 1 ? corsOrigins[0] : (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  }
};

app.use(cors(corsOptions));

app.get('/config', (req, res) => {
  const raw = (process.env.API_BASE_URL || '').trim();
  res.json({ apiBaseUrl: raw || '' });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeBody);

// Apply global API rate limiter
app.use('/api/', apiLimiter);

// Database availability guard clause for development fallback stability
app.use('/api/', (req, res, next) => {
  if (!isDbConnected && req.path !== '/health') {
    return res.status(503).json({ error: 'Database service is currently unavailable.' });
  }
  next();
});

// --- Mount Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/chat', require('./routes/chat'));

// Mount listings with path matching tracking tag
app.use('/api/listings', (req, res, next) => {
  req.isListingsRequest = true;
  next();
}, require('./routes/listings'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 404 handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Centralized Error Boundary ---
app.use((err, req, res, next) => {
  const userId = req.user ? req.user.id : null;
  
  if (req.isListingsRequest) {
    console.error('Listings error boundary caught:', err);
    const errorType = err.message.toLowerCase().includes('database') ? 'database_error' : 'listings_error';
    
    logSecurityEvent(errorType, userId, req.ip, `Listings error: ${err.message}`).catch(console.error);

    if (err.message.includes('not found') || err.message.includes('no listings')) {
      return res.status(404).json({ error: 'No listings found', details: err.message, timestamp: new Date().toISOString() });
    }
    if (err.message.includes('validation') || err.message.includes('invalid')) {
      return res.status(400).json({ error: 'Invalid request', details: err.message, timestamp: new Date().toISOString() });
    }
    if (err.message.toLowerCase().includes('database') || err.message.includes('connection') || err.message.includes('pool')) {
      return res.status(503).json({ error: 'Database unavailable', details: 'Unable to process data operation cleanly right now.', timestamp: new Date().toISOString() });
    }
    return res.status(500).json({ error: 'Listings service error', details: process.env.NODE_ENV === 'development' ? err.message : undefined, timestamp: new Date().toISOString() });
  }

  // Global Fallback Stack
  console.error("Unhandled server error:", err);
  logSecurityEvent('server_error', userId, req.ip, `Unhandled error: ${err.message}`).catch(console.error);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

// --- Serve Frontend Static Assets (React SPA Fallback) ---
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

// Graceful Process Interception
process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

let _server = null;
function gracefulShutdown(signal) {
  console.log(`\n⚠  ${signal} received – shutting down gracefully…`);
  if (_server) {
    _server.close(() => {
      console.log('  ✓ HTTP server closed');
      const pool = getPool();
      if (pool && typeof pool.end === 'function') {
        pool.end().then(() => {
          console.log('  ✓ Database pool closed');
          process.exit(0);
        }).catch(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
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
}

startServer();