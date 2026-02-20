# Al-Bayt Manager

Multi-tenant building management system for residential buildings in Israel. Manages apartments, payments, expenses, and tenants with support for Arabic, Hebrew, and English.

## Quick Start with Docker

### 1. Start the services

```bash
docker compose up --build -d
```

This starts PostgreSQL, the backend server, and the frontend. The database schema is automatically migrated on startup.

### 2. Create an admin account

After the services are running, create your first admin user:

```bash
docker compose exec server node dist/create-admin.js admin@example.com
```

Replace `admin@example.com` with your email. The command will print the auto-generated password on screen:

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

Save the password - it is only shown once.

### 3. Open the app

Go to [http://localhost:8080](http://localhost:8080) and log in with the credentials from step 2.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | `albayt_dev_password` | PostgreSQL password |
| `JWT_SECRET` | auto-generated | JWT signing secret (pin for production) |
| `JWT_REFRESH_SECRET` | auto-generated | Refresh token secret (pin for production) |
| `CORS_ORIGIN` | `http://localhost:8080` | Allowed CORS origin |
| `VITE_API_URL` | `http://localhost:3000/api` | API URL for frontend |
| `TURNSTILE_SECRET_KEY` | - | Cloudflare Turnstile secret |
| `RESEND_API_KEY` | - | Resend email API key |

For production, set `JWT_SECRET` and `JWT_REFRESH_SECRET` to stable 32+ character strings in a `.env` file. If not set, they are auto-generated on each restart (invalidating all existing sessions).

## Local Development

```bash
# Frontend
npm install
npm run dev         # http://localhost:8080

# Backend
cd server
npm install
npm run dev         # http://localhost:3000

# Tests
cd server
npm test
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS
- **Backend:** Express, Drizzle ORM, PostgreSQL
- **Auth:** JWT + Refresh tokens + TOTP 2FA
- **Infra:** Docker, Nginx
