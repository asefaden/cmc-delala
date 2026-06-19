require('dotenv').config();
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
    console.error('FATAL ERROR: JWT_SECRET is not configured or uses a development default in production!');
    console.error('Application startup aborted to prevent unpredictable token verification behavior.');
    process.exit(1);
  }
} else {
  // Safe fallback fallback ONLY for local development
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret_only_for_local';
}

const app = express();
const PORT = process.env.PORT || 3000;

// Variables tracking operational health
let isDbConnected = false;

// 1. Health check endpoint - updated to reflect true database connectivity state
app.get('/health', (req, res) => {
  if (!isDbConnected) {
    return res.status(503).json({ status: 'unhealthy', database: 'disconnected', timestamp: new Date().toISOString() });
  }
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
const frontendDist = path.join(__dirname, '..', 'dist');
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

  // 2. Initialize database dependencies BEFORE opening the HTTP port to traffic
  try {
    await initDb();
    isDbConnected = true;
    console.log('  ✓ Database: Connected & schema ready');
  } catch (err) {
    console.error('  ✗ Database: FAILED —', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Cannot start production server without database connection.');
      process.exit(1);
    }
    console.warn('  Running in development fallback mode without DB...');
  }

  // 3. Start listening
  const server = app.listen(PORT, '0.0.0.0', () => {
    const env = process.env.NODE_ENV || 'development';
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          ሲኤምሲ ደላላ (CMC Delal) Backend                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Status:    ✓ Running                                    ║`);
    console.log(`║  Env:       ${env.padEnd(45)}║`);
    console.log(`║  URL:       ${('http://localhost:' + PORT).padEnd(45)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${PORT} is already in use.`);
    } else {
      console.error('FATAL: Server error:', err);
    }
    process.exit(1);
  });
}

startServer();