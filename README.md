# ሲኤምሲ ደላላ — CMC Delal

**Secure Ethiopian Broker (Delal) Platform** — one-click deploy on AletCloud.

## 🚀 Deploy on AletCloud (single service)

This repo is pre-configured for **single-service deployment** — the backend serves both the API and the built frontend. No separate frontend hosting needed.

### 1-click deploy

1. In AletCloud, create a new **Service** → **Public Repository**
2. Enter `https://github.com/asefaden/cmc-delala`
3. Set the **Build Pack** to `Paketo`

### Required environment variables

| Variable | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Enables production mode |
| `JWT_SECRET` | `openssl rand -hex 64` | **⚠️ Required.** Generate a strong secret |
| `FRONTEND_URL` | `*` | CORS — same-origin SPA, so `*` is fine |
| `API_BASE_URL` | `*` | Same-origin API |
| `BP_NODE_RUN_SCRIPTS` | `build` | Tells Paketo to run the frontend build |

### Optional environment variables (database)

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | MariaDB/MySQL host |
| `DB_PORT` | `3306` | Database port |
| `DB_NAME` | `delala` | Database name |
| `DB_USER` | `admin_delala` | Database user |
| `DB_PASSWORD` | *required* | Database password |

### How it works

The root `package.json` orchestrates everything during deployment:

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
│       • / (built frontend)  │
│       • /health (uptime)    │
└─────────────────────────────┘
```

The server is listening on `0.0.0.0:3000` — AletCloud will forward traffic automatically.

### Adding a database (MariaDB)

1. In AletCloud, create a new **Database** → **MariaDB**
2. Copy the connection details into your service's environment variables:
   - `DB_HOST` = the database service hostname
   - `DB_PORT` = `3306`
   - `DB_NAME`, `DB_USER`, `DB_PASSWORD` = whatever you set

## 🐳 Alternative: Docker Compose

For full control with a bundled MariaDB:

```bash
git clone https://github.com/asefaden/cmc-delala
cd cmc-delala/backend

# Set your JWT_SECRET
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env

# Start everything
docker compose up -d
```

The app will be at `http://localhost:3000`.

## 🛠️ Local development

**Prerequisites:** Node 18+, MariaDB/MySQL running locally.

```bash
# Copy and edit environment
cp backend/.env.example backend/.env

# Install backend deps
cd backend && npm install

# In a new terminal — install & run frontend
cd frontend && npm install && npm run dev

# In the first terminal — run backend
cd backend && npm run dev
```

Frontend dev server runs on `:5173` with proxy to `:3000`.

## 📁 Project structure

```
├── package.json          ← Root orchestrator (Paketo entry point)
├── backend/
│   ├── server.js         ← Express API + static frontend server
│   ├── database.js       ← MariaDB/MySQL connection
│   ├── routes/           ← API route handlers
│   └── docker-compose.yml
├── frontend/
│   ├── src/              ← React app (Vite)
│   └── package.json
└── README.md
