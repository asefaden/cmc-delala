require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./database');
const { apiLimiter, logSecurityEvent, sanitizeBody } = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Health check endpoint - MUST be at the top for cloud platform uptime checks
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Frontend configuration endpoint
app.get('/config', (req, res) => {
  // Treat '*' or empty as same-origin (no prefix needed)
  const raw = (process.env.API_BASE_URL || '').trim();
  res.json({ apiBaseUrl: (raw && raw !== '*') ? raw : '' });
});

// Set up security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"], // allow inline scripts for quick SPA and Lucide icons
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
// When FRONTEND_URL is '*' or unset, allow all origins (for development or same-origin SPA).
// When a specific URL is set, only allow that origin with credentials.
const corsOrigin = process.env.FRONTEND_URL;
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

if (!corsOrigin || corsOrigin === '*') {
  // Allow all origins — credentials won't work with wildcard in browsers,
  // but this is fine for same-origin SPA or development.
  corsOptions.origin = true; // Reflect the request origin
} else {
  corsOptions.origin = corsOrigin;
}

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sanitize all incoming request bodies to prevent XSS
app.use(sanitizeBody);

// Apply global API rate limiter
app.use('/api/', apiLimiter);

// --- Serve Built Frontend (production) ---
// If a built frontend dist exists, serve it as static files.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// --- Mount Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/admin', require('./routes/admin'));

// Serve uploaded files (avatars, documents)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// SPA fallback — in production, serve index.html for any non-API route
// so React Router can handle client-side navigation on page refresh.
if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendDist)) {
  const spaIndex = path.join(frontendDist, 'index.html');
  app.get('*', (req, res) => {
    res.sendFile(spaIndex);
  });
}

// Global Error Handler (4-arg signature tells Express this is an error handler)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  
  // Log critical server crashes/errors in security logs
  logSecurityEvent('server_error', req.user ? req.user.id : null, req.ip, `Unhandled error: ${err.message}`)
    .catch(console.error);

  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Handle uncaught exceptions and unhandled rejections to prevent silent container crashes
process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught Exception:', err);
  // Give the process a moment to flush logs before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize database and start server
async function startServer() {
  // Security check: Ensure JWT_SECRET is set in production
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('development'))) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║                    FATAL CONFIGURATION ERROR                ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║  JWT_SECRET is not defined or is set to a default value.   ║');
    console.error('║                                                            ║');
    console.error('║  In production, you MUST set a strong, unique JWT_SECRET   ║');
    console.error('║  as an environment variable in your hosting platform.      ║');
    console.error('║                                                            ║');
    console.error('║  Example (Coolify/Docker):                                 ║');
    console.error('║    JWT_SECRET=<your-random-secret-here>                    ║');
    console.error('║                                                            ║');
    console.error('║  Generate one with: node -e "console.log(require(\'crypto\')  ║');
    console.error('║    .randomBytes(64).toString(\'hex\'))"                       ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }

  // Ensure upload directory exists before routes are initialized
  const uploadDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("Upload directory initialized.");
    }
  } catch (err) {
    // ፅሁፉን ከ CRITICAL ወደ WARNING ቀይረነዋል፤ ሰርቨሩም እንዳይዘጋ ዝም ብሎ እንዲያልፍ ያደርገዋል
    console.warn("WARNING: Could not create upload directory via code:", err.message);
    console.log("Proceeding assuming directory is handled by Git tracking.");
  }

  // 1. Start listening immediately on all interfaces (0.0.0.0) for Docker compatibility
  const server = app.listen(PORT, '0.0.0.0', () => {
    const env = process.env.NODE_ENV || 'development';
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          ሲኤምሲ ደላላ (CMC Delal) Backend                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Status:    ✓ Running                                    ║`);
    console.log(`║  Env:       ${(env).padEnd(45)}║`);
    console.log(`║  URL:       ${('http://localhost:' + PORT).padEnd(45)}║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Routes:   /api/auth, /api/listings, /api/brokers,       ║');
    console.log('║            /api/admin, /health, /config                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  });

  // Handle server errors (e.g., port already in use)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`FATAL: Port ${PORT} is already in use. Cannot start server.`);
    } else {
      console.error('FATAL: Server error:', err);
    }
    process.exit(1);
  });

  // 2. Initialize database asynchronously.
  try {
    await initDb();
    console.log('  ✓ Database: Connected & schema ready');
  } catch (err) {
    console.warn('  ✗ Database: FAILED —', err.message);
    console.warn('    Server is running WITHOUT database access. Check your DB environment variables.');
    console.warn('    API endpoints requiring database will return 500 errors until DB is available.');
  }
}

// Run the server bootstrap execution
startServer();
