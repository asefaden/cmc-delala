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
  res.json({ apiBaseUrl: process.env.API_BASE_URL || '' });
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
app.use(cors({
  origin: true,
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sanitize all incoming request bodies to prevent XSS
app.use(sanitizeBody);

// Apply global API rate limiter
app.use('/api/', apiLimiter);

// --- Mount Routes and Static Files ---
// Defining routes outside the async startup ensures the server is ready 
// to handle health checks and static files immediately upon binding to the port.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/admin', require('./routes/admin'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  
  // Log critical server crashes/errors in security logs
  logSecurityEvent('server_error', req.user ? req.user.id : null, req.ip, `Unhandled error: ${err.message}`)
    .catch(console.error);

  return res.status(500).json({ error: 'Something went wrong on the server.' });
  next();
});

// Initialize database and start server
async function startServer() {
  // Ensure upload directory exists before routes are initialized
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("Upload directory initialized.");
    }
  } catch (err) {
    console.error("CRITICAL: Could not ensure upload directory exists:", err.message);
  }

  // 1. Start listening immediately. 
  // This prevents 503 Service Unavailable errors by letting the deployment 
  // platform know the service is "up" while the database connects in the background.
  app.listen(PORT, () => {
    console.log(`========================================================`); 
    console.log(`   ሲኤምሲ ደላላ (CMC Delal) Backend is running!`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Port: ${PORT}`);
    console.log(`========================================================`);
  });

  // 2. Initialize database asynchronously.
  try {
    console.log("Initializing database...");
    await initDb();
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("WARNING: Database initialization failed:", err.message);
    console.error("Server is running WITHOUT database access. Check your DB environment variables.");
  }
}

// Start with error catching to prevent silent process exits
startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
