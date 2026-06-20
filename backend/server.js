// dotenv v17+ (@dotenvx/dotenvx) auto-injects .env on import — no .config() call needed
require('dotenv');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./database');
const { apiLimiter, logSecurityEvent, sanitizeBody } = require('./security');

// STRICT CHECK: Fail loudly and immediately if JWT_SECRET is missing or insecure in production
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
  // Safe fallback fallback ONLY for local development
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret_only_for_local';
}

const app = express();
const PORT = process.env.PORT || 8080;

// Variables tracking operational health
let isDbConnected = false;
let isStarting = true;

// 1. Health check – always 200 once the server is listening so the
//    platform reverse-proxy never shows "Bad Gateway" during normal operation.
app.get('/health', (_req, res) => {
  const dbOk = isDbConnected;
  const status = isStarting ? 'starting' : (dbOk ? 'ok' : 'degraded');
  const code    = isStarting ? 200 : 200;           // keep 200 so proxy stays happy
  res.status(code).json({
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
  res.json({ apiBaseUrl: (raw && raw !== '*') ? raw : '' });
});

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.unsplash.com"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS Configuration
const corsOrigin = process.env.FRONTEND_URL;
const corsOptions = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (!corsOrigin || corsOrigin === '*') {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WARNING: Allowing all origins in production without credentials.');
  }
  corsOptions.origin = '*';
  corsOptions.credentials = false; // Cannot use credentials with a literal wildcard '*' securely or legally in modern browsers
} else {
  corsOptions.origin = corsOrigin;
  corsOptions.credentials = true;
}

app.use(cors(corsOptions));

// Standard Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sanitize inputs
app.use(sanitizeBody);

// Apply global API rate limiter
app.use('/api/', apiLimiter);

// --- Mount Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/admin', require('./routes/admin'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Serve Frontend (React SPA) ---
const frontendDist = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')       // Docker: /workspace/dist
  : path.join(__dirname, '..', 'dist'); // Local: project-root/dist
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  
  logSecurityEvent('server_error', req.user ? req.user.id : null, req.ip, `Unhandled error: ${err.message}`)
    .catch(console.error);

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

// Graceful shutdown on SIGTERM / SIGINT (sent by Railway / Docker / process managers)
const { getPool } = require('./database');
let _server = null; // will be set after app.listen

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
  // Force-kill after 8 s so the platform doesn't SIGKILL us
  setTimeout(() => {
    console.error('  ✗ Forced shutdown after timeout');
    process.exit(1);
  }, 8000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Bootstrap Server Setup
async function startServer() {
  // 1. Enforce upload directory existence
  const uploadDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("Upload directory initialized.");
    }
  } catch (err) {
    console.warn("WARNING: Could not create upload directory via code:", err.message);
  }

  // 2. Log environment variable status (without exposing secrets)
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

  // 3. Initialize database dependencies BEFORE opening the HTTP port to traffic
  try {
    await initDb();
    isDbConnected = true;
    console.log('  ✓ Database: Connected & schema ready');
  } catch (err) {
    console.error('  ✗ Database: FAILED —', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('');
      console.error('╔════════════════════════════════════════════════════════════╗');
      console.error('║  DATABASE CONNECTION FAILED IN PRODUCTION                 ║');
      console.error('╠════════════════════════════════════════════════════════════╣');
      console.error('║  Check that these environment variables are set:         ║');
      console.error('║    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD       ║');
      console.error('║  Set them in your alecloud deployment dashboard.         ║');
      console.error('╚════════════════════════════════════════════════════════════╝');
      process.exit(1);
    }
    console.warn('  Running in development fallback mode without DB...');
  }

  // 3. Start listening
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