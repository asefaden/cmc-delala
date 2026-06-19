# ሲኤምሲ ደላላ — CMC Delal

**Secure Ethiopian Broker (Delal) Platform**

## 🚀 Deploy

Frontend and backend are **independently deployable services** that communicate via REST API.

---

## 📁 Project Structure

```
├── backend/               ← Node.js/Express API server
│   ├── server.js          ← Express API server
│   ├── database.js        ← MariaDB/MySQL connection & schema
│   ├── routes/            ← API route handlers
│   ├── .env               ← Backend environment variables
│   └── .env.example       ← Environment variable template
├── frontend/              ← React SPA (Vite)
│   ├── src/               ← React app source
│   ├── vite.config.js     ← Vite config with dev proxy
│   ├── .env               ← Development environment
│   ├── .env.production    ← Production environment (API URL)
│   ├── .env.example       ← Environment variable template
│   └── package.json
└── README.md
```

---

## 🖥️ Local Development

**Prerequisites:** Node 18+, MariaDB/MySQL running locally.

### Backend

```bash
cd backend
cp .env.example .env    # Edit with your DB credentials and JWT_SECRET
npm install
npm run dev              # Starts on :3000
```

### Frontend (new terminal)

```bash
cd frontend
cp .env.example .env    # Leave VITE_API_BASE_URL empty for dev proxy
npm install
npm run dev              # Starts on :5173, proxies /api to :3000
```

The Vite dev server proxies `/api`, `/uploads`, `/health`, and `/config` to `localhost:3000`.

---

## 🌐 Production Deployment

Frontend and backend are deployed **separately** as independent services.

### Backend (API Server)

1. Clone and configure:

```bash
git clone https://github.com/asefaden/cmc-delala.git
cd cmc-delala/backend
cp .env.example .env
```

2. Set environment variables:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | *(generate one)* | ⚠️ **Required.** See below |
| `FRONTEND_URL` | `https://your-frontend.com` | CORS — your frontend domain |
| `API_BASE_URL` | `https://api.yourdomain.com` | Backend public URL |
| `DB_HOST` | `your-db-host` | MySQL/MariaDB host |
| `DB_PORT` | `3306` | MySQL/MariaDB port |
| `DB_NAME` | `delala` | Database name |
| `DB_USER` | `your-db-user` | Database user |
| `DB_PASSWORD` | `your-db-password` | Database password |

Generate a JWT secret:
```bash
openssl rand -hex 64
```

3. Install and start:

```bash
npm install
npm start
```

Database tables and seed data are created on first boot.

### Frontend (Static SPA)

1. Configure:

```bash
cd frontend
cp .env.production .env.production
```

Edit `.env.production`:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

2. Build:

```bash
npm install
npm run build
```

3. Deploy the `dist/` folder to any static host:
   - **Netlify**, **Vercel**, **Cloudflare Pages**, **GitHub Pages**, **AWS S3**, etc.

---

## 🔒 Production Checklist

### Backend
- [ ] Set `NODE_ENV=production`
- [ ] Set a strong `JWT_SECRET`
- [ ] Configure database connection (`DB_HOST`, `DB_PORT`, etc.)
- [ ] Set `FRONTEND_URL` to your frontend domain (for CORS)
- [ ] Set `API_BASE_URL` to your backend public URL

### Frontend
- [ ] Set `VITE_API_BASE_URL` in `.env.production` to your backend URL
- [ ] Run `npm run build` to build the production bundle
- [ ] Deploy `dist/` to your static hosting provider