# ሲኤምሲ ደላላ — CMC Delal

**Secure Ethiopian Broker (Delal) Platform**

## 🚀 Deploy on AletCloud (2 minutes)

**You deploy ONE service.** The Express backend serves both the API (`/api/*`) and the React frontend (`/`) from a single process.

### Step 1: Create the service

1. AletCloud → **Services** → **Create** → **Public Repository**
2. Repository: `https://github.com/asefaden/cmc-delala`
3. **Build Pack** = `Paketo` (default)

### Step 2: Set environment variables

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production mode |
| `JWT_SECRET` | *(generate one)* | ⚠️ **Required.** See below |
| `FRONTEND_URL` | `*` | CORS — same-origin SPA |
| `API_BASE_URL` | `*` | Same-origin API |
| `BP_NODE_RUN_SCRIPTS` | `build` | Tells Paketo to build the frontend |

Generate a JWT secret:
```bash
openssl rand -hex 64
```

### Step 3: Add a database

1. AletCloud → **Databases** → **MariaDB** → Create
2. Copy connection details into your service's env vars:

| Variable | Example |
|---|---|
| `DB_HOST` | `db-svc.internal.aletcloud.com` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `delala` |
| `DB_USER` | `admin_delala` |
| `DB_PASSWORD` | `your_password` |

### That's it!

The server starts on port `3000` and AletCloud routes traffic automatically.
Database tables and seed data are created on first boot.

---

## How the build works

```
AletCloud triggers:
┌─────────────────────────────┐
│ 1. npm install              │
│    └─ postinstall:          │
│       cd backend && npm ci  │
├─────────────────────────────┤
│ 2. npm run build            │
│    └─ cd frontend           │
│       && npm ci             │
│       && npm run build      │
│    → outputs frontend/dist/ │
├─────────────────────────────┤
│ 3. npm start                │
│    └─ node backend/server.js│
│    → Express serves:        │
│       • /api/* (JSON API)   │
│       • / (React SPA)       │
│       • /health (uptime)    │
└─────────────────────────────┘
```

---

## 🐳 Local development with Docker

```bash
git clone https://github.com/asefaden/cmc-delala
cd cmc-delala/backend

# Set your JWT_SECRET
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env

# Start everything (app + MariaDB)
docker compose up -d
```

App runs at `http://localhost:3000`.

---

## 🛠️ Local development (manual)

**Prerequisites:** Node 18+, MariaDB/MySQL running locally.

```bash
# 1. Copy and edit environment
cp backend/.env.example backend/.env
# Edit backend/.env with your DB credentials and JWT_SECRET

# 2. Install & run backend
cd backend && npm install && npm run dev

# 3. In a new terminal — install & run frontend
cd frontend && npm install && npm run dev
```

Frontend dev server runs on `:5173` with proxy to `:3000`.

---

## 📁 Project structure

```
├── package.json          ← Root orchestrator (AletCloud entry point)
├── Dockerfile            ← Production Docker build (frontend + backend)
├── backend/
│   ├── server.js         ← Express API + static frontend server
│   ├── database.js       ← MariaDB/MySQL connection & schema
│   ├── routes/           ← API route handlers
│   └── docker-compose.yml
├── frontend/
│   ├── src/              ← React app (Vite)
│   ├── vite.config.js
│   └── package.json
└── README.md