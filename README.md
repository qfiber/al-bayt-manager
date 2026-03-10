# Al-Bayt Manager

A full-stack building management system designed for residential property managers in Israel. Tracks apartments, tenants, monthly payments, building expenses, and maintenance — with built-in multi-language support for Arabic, Hebrew, and English (including full RTL).

## Features

- **Buildings & Apartments** — manage multiple buildings, apartment units, occupancy periods, and tenant assignments
- **Payments & Expenses** — record monthly payments, building expenses with per-apartment allocation, and automatic balance calculation
- **Tenant Portal** — tenants see their own dashboard with balance, payment history, and can report issues
- **Issue Tracking** — tenants report maintenance issues, admins/moderators track and resolve them
- **Maintenance Jobs** — schedule and assign maintenance work
- **Notifications** — email (via Resend), SMS (via 019 provider), and Ntfy push notifications with multilingual templates
- **Reports** — financial summaries, monthly trends, building-level breakdowns, PDF receipts
- **Debt Collection** — automated reminders via cron (1st and 7th of month), configurable collection stages
- **Roles** — admin (full access), moderator (scoped to assigned buildings), user/tenant (own apartments only)
- **Security** — JWT + refresh tokens, TOTP 2FA, Cloudflare Turnstile CAPTCHA, proof-of-work challenge, rate limiting, audit logs
- **Internationalization** — Arabic (default), Hebrew, English with full RTL support
- **PWA** — installable as a mobile app with offline caching

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | JWT + refresh tokens, TOTP 2FA (otplib) |
| Email | Resend API |
| SMS | 019 SMS provider (Israeli) |
| PDF | PDFKit |
| Infra | Docker, Nginx |

---

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose

### 1. Clone and configure

```bash
git clone <repo-url>
cd al-bayt-manager
```

Create a `.env` file in the project root:

```env
DB_PASSWORD=your_secure_db_password
```

Create `server/.env` (copy from example):

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set at minimum:

```env
DATABASE_URL=postgresql://albayt:your_secure_db_password@postgres:5432/albayt
JWT_SECRET=<random-string-at-least-32-characters>
JWT_REFRESH_SECRET=<another-random-string-at-least-32-characters>
CORS_ORIGIN=http://localhost:8080
```

> **Important:** Set stable `JWT_SECRET` and `JWT_REFRESH_SECRET` values. If left unset, they auto-generate on each restart, invalidating all user sessions.

### 2. Start the services

```bash
docker compose up --build -d
```

This starts PostgreSQL, builds the frontend, and runs the backend server. Database migrations run automatically on startup.

### 3. Create an admin account

```bash
docker compose exec server node dist/create-admin.js admin@example.com
```

Replace `admin@example.com` with your email. The command prints the auto-generated password:

```
╔══════════════════════════════════════════════════╗
║            ADMIN ACCOUNT CREATED                 ║
╠══════════════════════════════════════════════════╣
║  Email:    admin@example.com                     ║
║  Password: xK7#mP2&nQ9$wR4+                     ║
╠══════════════════════════════════════════════════╣
║  Change this password after first login!         ║
╚══════════════════════════════════════════════════╝
```

Save the password — it is only shown once.

### 4. Open the app

Go to [http://localhost:8080](http://localhost:8080) and log in with the credentials from step 3.

---

## Local Development (without Docker)

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ running locally

### 1. Set up the database

Create a PostgreSQL database and user:

```sql
CREATE USER albayt WITH PASSWORD 'your_password';
CREATE DATABASE albayt OWNER albayt;
```

### 2. Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
NODE_ENV=development
PORT=4010
DATABASE_URL=postgresql://albayt:your_password@localhost:5432/albayt
JWT_SECRET=<random-string-at-least-32-characters>
JWT_REFRESH_SECRET=<another-random-string-at-least-32-characters>
CORS_ORIGIN=http://localhost:8080
UPLOAD_DIR=./uploads
```

### 3. Configure the frontend

```bash
# From the project root
cp .env.example .env
```

The defaults should work as-is (`VITE_API_URL=/api` is proxied by Vite to the backend).

### 4. Install dependencies and start

```bash
# Terminal 1 — Backend
cd server
npm install
npm run dev         # Starts on http://localhost:4010

# Terminal 2 — Frontend
npm install
npm run dev         # Starts on http://localhost:8080
```

The backend automatically runs database migrations and seeds default notification templates on startup.

### 5. Create an admin account

```bash
cd server
npm run build
node dist/create-admin.js admin@example.com
```

### 6. Open the app

Go to [http://localhost:8080](http://localhost:8080) and log in.

---

## Environment Variables

### Root `.env`

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | — | PostgreSQL password (used by Docker Compose) |
| `VITE_API_URL` | `/api` | API base URL for the frontend |
| `VITE_TURNSTILE_SITE_KEY` | — | Cloudflare Turnstile site key (optional) |

### `server/.env`

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` or `production` |
| `PORT` | `4010` | Backend server port |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `DB_SSL` | — | `true`, `false`, or `no-verify` for self-signed certs |
| `JWT_SECRET` | auto-generated | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | auto-generated | Refresh token secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token TTL |
| `CORS_ORIGIN` | `http://localhost:8080` | Allowed CORS origin(s) |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `RESEND_API_KEY` | — | Resend email API key (optional) |
| `TURNSTILE_SECRET_KEY` | — | Cloudflare Turnstile secret (optional) |
| `POW_DIFFICULTY` | `20` | Proof-of-work difficulty bits |
| `POW_CHALLENGE_TTL_MS` | `300000` | PoW challenge expiry (ms) |

---

## Scripts

### Frontend (root `package.json`)

```bash
npm run dev       # Start Vite dev server on port 8080
npm run build     # Production build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

### Backend (`server/package.json`)

```bash
npm run dev           # Start with tsx watch (hot reload)
npm run build         # Compile TypeScript to dist/
npm run start         # Run compiled server (node dist/index.js)
npm run db:generate   # Generate Drizzle migration from schema changes
npm run db:migrate    # Run migrations via drizzle-kit
npm run db:push       # Push schema directly (no migration file)
npm run db:studio     # Open Drizzle Studio (DB browser)
npm test              # Run tests (vitest)
```

---

## Production Deployment

An example Nginx config is included in `nginx.conf`. It serves the frontend static files and proxies `/api/` to the backend.

A deployment script is included:

```bash
chmod +x deploy.sh
./deploy.sh
```

This script installs dependencies, builds both frontend and backend, and creates necessary directories.

For systemd, create a service file pointing to `node dist/index.js` in the server directory with the appropriate environment variables.

---

## Project Structure

```
al-bayt-manager/
├── src/                          # Frontend source
│   ├── pages/                    # Page components
│   ├── components/               # Shared components
│   │   └── ui/                   # shadcn/ui (auto-generated, do not edit)
│   ├── contexts/                 # React contexts (Auth, Language, PublicSettings)
│   ├── hooks/                    # Custom hooks
│   └── lib/
│       ├── i18n.ts               # All translations (he/ar/en)
│       ├── api.ts                # API client
│       └── utils.ts              # Utility functions
├── server/
│   ├── src/
│   │   ├── index.ts              # Entry point (migrations + server start)
│   │   ├── app.ts                # Express app setup + routes
│   │   ├── create-admin.ts       # Admin seeding utility
│   │   ├── config/               # Environment + database config
│   │   ├── db/
│   │   │   ├── schema/           # Drizzle table definitions
│   │   │   └── migrations/       # SQL migration files
│   │   ├── routes/               # Express route handlers
│   │   ├── services/             # Business logic
│   │   ├── middleware/           # Auth, rate limiting, validation
│   │   └── utils/                # Helpers (bcrypt, JWT, etc.)
│   ├── Dockerfile
│   └── drizzle.config.ts
├── docker-compose.yml
├── nginx.conf                    # Production Nginx config
├── deploy.sh                     # Deployment script
└── vite.config.ts
```

---

## License

Proprietary — qFiber LTD ([qfiber.co.il](https://qfiber.co.il))
