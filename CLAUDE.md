# Al-Bayt Manager - Building Management System

## Project Overview
Multi-tenant building management system for managing residential buildings, apartments, payments, expenses, and tenants. Built for an Israeli market (shekel currency ₪), supporting Arabic, Hebrew, and English.

**Company:** qFiber LTD (qfiber.co.il)
**Origin:** Initially scaffolded with Lovable.dev, migrated from Supabase to custom Express backend.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite (SWC compiler)
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS
- **Backend:** Express.js + Node.js (TypeScript)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Custom JWT (access + refresh tokens in httpOnly cookies) + bcryptjs + TOTP 2FA
- **State:** React Query (@tanstack/react-query) for server state, React Context for auth/language/settings
- **Forms:** react-hook-form + zod
- **Charts:** Recharts
- **Icons:** lucide-react
- **Date:** date-fns (but many pages use manual date parsing)
- **Email:** Resend API
- **Logging:** Pino (structured logging)
- **PDF:** pdfkit (receipts/invoices)
- **File Uploads:** Multer

## Development
```bash
# Frontend
npm run dev       # Start dev server on port 8080
npm run build     # Production build
npm run lint      # ESLint

# Backend (from server/)
npm run dev              # Start dev server with tsx watch (port 4010)
npm run build            # TypeScript compilation
npm start                # Run compiled dist/index.js
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio IDE
npm run create-admin     # CLI to create admin user
npm run test             # Run tests with vitest
```

## Project Structure
```
src/
├── App.tsx                    # Router setup, provider hierarchy
├── main.tsx                   # Entry point
├── contexts/
│   ├── AuthContext.tsx         # JWT auth state, role checks (admin/moderator), sign in/out
│   ├── LanguageContext.tsx     # i18n context, RTL support
│   └── PublicSettingsContext.tsx # Public settings (branding, currency, CAPTCHA config)
├── components/
│   └── ui/                    # shadcn/ui components (DO NOT edit manually)
├── lib/
│   ├── api.ts                 # HTTP client (fetch-based, auto-refresh on 401)
│   ├── i18n.ts                # Translation strings (he/ar/en)
│   ├── pow.ts                 # Proof-of-Work challenge solver
│   ├── pow-worker.ts          # Web Worker for PoW computation
│   ├── types.ts               # Shared TypeScript types
│   └── utils.ts               # cn(), date format helpers
├── pages/
│   ├── Auth.tsx               # Login + PoW + 2FA + CAPTCHA
│   ├── Register.tsx           # User registration (gated by setting)
│   ├── Setup2FA.tsx           # 2FA setup flow
│   ├── Profile.tsx            # User profile editing
│   ├── Dashboard.tsx          # Main dashboard with role-based cards
│   ├── Buildings.tsx          # CRUD buildings (admin only)
│   ├── Apartments.tsx         # CRUD apartments, debt view, terminate occupancy
│   ├── Payments.tsx           # Payment management + expense allocation
│   ├── Expenses.tsx           # Expense management, recurring, single/split
│   ├── Reports.tsx            # Financial reports + charts
│   ├── Settings.tsx           # System settings (fees, language, CAPTCHA, email)
│   ├── UserManagement.tsx     # User CRUD, role assignment, apartment/building assignment
│   ├── MyApartments.tsx       # Tenant portal (read-only)
│   ├── ApiKeys.tsx            # API key management
│   ├── AuditLogs.tsx          # Activity audit trail
│   ├── EmailTemplates.tsx     # Email template CRUD with translations
│   ├── EmailLogs.tsx          # Email delivery history
│   ├── DebtCollection.tsx     # Debt collection workflow
│   ├── Documents.tsx          # Document management
│   ├── Issues.tsx             # Issue/ticket tracking
│   ├── MaintenanceJobs.tsx    # Maintenance job tracking
│   ├── Meetings.tsx           # Meeting CRUD + decisions
│   ├── BulkOperations.tsx     # Bulk operations
│   ├── Portfolio.tsx          # Portfolio view
│   ├── Accessibility.tsx      # Accessibility settings
│   ├── PrivacyPolicy.tsx      # Privacy policy page
│   ├── TermsOfUsage.tsx       # Terms of usage page
│   └── NotFound.tsx
server/
├── src/
│   ├── index.ts               # Entry point, server startup, migrations
│   ├── app.ts                 # Express app setup, middleware, route mounting
│   ├── config/
│   │   ├── database.ts        # Drizzle ORM + PostgreSQL pool init
│   │   └── env.ts             # Zod-validated environment variables
│   ├── db/
│   │   ├── schema/            # 43 Drizzle schema files (DO NOT edit types.ts manually)
│   │   └── migrations/        # SQL migrations
│   ├── middleware/
│   │   ├── auth.ts            # JWT token verification (cookie or Bearer)
│   │   ├── roles.ts           # Role-based access control
│   │   ├── validate.ts        # Zod schema validation
│   │   ├── error-handler.ts   # Custom AppError handling
│   │   ├── audit.ts           # Automatic audit log creation
│   │   ├── api-key.ts         # API key auth for v1 API
│   │   ├── rate-limit.ts      # Memory-based rate limiting (deprecated)
│   │   ├── db-rate-limit.ts   # DB-backed rate limiting
│   │   ├── pow.ts             # Proof-of-Work challenge validation
│   │   └── building-scope.ts  # Moderator building scope filtering
│   ├── routes/                # 23 route files (auth, buildings, apartments, etc.)
│   ├── services/              # 34 service files (business logic layer)
│   └── utils/
│       ├── jwt.ts             # JWT signing/verification
│       └── bcrypt.ts          # Password hashing (12 salt rounds)
├── drizzle.config.ts          # Drizzle ORM configuration
└── package.json
docker/                        # Docker configuration
docker-compose.yml             # PostgreSQL + frontend build + server
nginx.conf                     # Nginx reverse proxy config
```

## Database Schema (43 tables via Drizzle ORM)

### Core
- **users** - User accounts (email, passwordHash, emailConfirmed)
- **profiles** - User profiles (name, phone, preferred_language, avatar)
- **user_roles** - Role assignments (admin/moderator/user)
- **refresh_tokens** - JWT refresh token storage with revocation
- **totp_factors** - 2FA TOTP secrets and status
- **account_lockouts** - Failed login tracking

### Business Domain
- **buildings** - Building records (name, address, floors, logo)
- **apartments** - Apartment units (building_id, status, balance tracking)
- **occupancy_periods** - Apartment occupancy history
- **apartment_ledger** - Complete ledger of credits/debits per apartment
- **payments** - Monthly payments (apartment_id, month, amount, is_canceled)
- **expenses** - Building expenses (building_id, amount, category, recurring)
- **apartment_expenses** - Per-apartment expense allocations
- **payment_allocations** - Payment-to-expense allocation audit trail

### Financial
- **receipts** - Receipt records
- **invoices** - Invoice records
- **documents** - General document storage
- **document_sequences** - Document number sequences
- **debt_collection_stages** - Debt collection workflow stages
- **debt_collection_log** - Collection activity log

### Communication
- **email_templates** / **email_template_translations** - Email template system
- **email_logs** - Email delivery history
- **sms_templates** / **sms_template_translations** - SMS template system
- **sms_logs** - SMS delivery history
- **ntfy_templates** / **ntfy_template_translations** - Notification templates

### Other
- **issue_reports** / **issue_attachments** - Issue tracking
- **maintenance_jobs** - Maintenance task tracking
- **meetings** / **meeting_attendees** / **meeting_decisions** - Meeting governance
- **settings** - System settings
- **api_keys** - API key hashes
- **audit_logs** - Activity audit trail
- **rate_limit_entries** - DB-backed rate limiting
- **general_information** - Dashboard info cards
- **user_apartments** - User-apartment assignments
- **moderator_buildings** - Moderator-building assignments

## Key Patterns & Conventions

### Financial Logic (CRITICAL)
- **Balance formula:** `credit = totalPayments - totalExpenses - totalSubscription`
- Negative credit = debt, positive credit = overpayment
- All financial recalculation lives in `server/src/services/ledger.service.ts`
- Expenses are split among occupied apartments when created
- Payments can be allocated to specific expenses via `payment_allocations`
- Soft delete pattern: `is_canceled` flag instead of actual deletion

### Date Handling
- UI displays dates as **dd/mm/yyyy**
- Database stores dates as **yyyy-mm-dd**
- Manual conversion in pages (not centralized for all pages)
- `src/lib/utils.ts` has helpers: `formatDate()`, `toInputDate()`, `fromInputDate()`

### Internationalization
- 3 languages: Hebrew (he), Arabic (ar), English (en)
- Default language: Arabic
- RTL for Arabic and Hebrew
- All strings in `src/lib/i18n.ts` as a flat key-value object
- Type: `TranslationKey` derived from Hebrew keys
- Usage: `const { t } = useLanguage(); t('keyName')`
- **When adding features, always add translations for all 3 languages**

### Authentication & Security
- Custom JWT auth (NOT Supabase)
- Access token: 15min expiry, httpOnly cookie
- Refresh token: 7 days expiry, httpOnly cookie, stored in DB
- Password: bcryptjs, 12 salt rounds, min 16 chars
- 2FA: TOTP via otplib (authenticator apps)
- CAPTCHA: Cloudflare Turnstile
- Proof-of-Work: SHA-256 nonce solving before login/register
- Rate limiting: DB-backed (survives restarts)
- Account lockout: progressive lockout on failed attempts
- No self-service password reset — admin only via `POST /api/users/:id/change-password`
- Admin creation: `cd server && npm run create-admin`

### API Communication
- Frontend uses `src/lib/api.ts` (fetch-based, `credentials: 'include'`)
- Auto-refresh on 401 responses
- Methods: `api.get()`, `api.post()`, `api.put()`, `api.delete()`, `api.upload()`
- All API routes under `/api/` prefix

### Roles
- 3 roles: `admin`, `moderator`, `user`
- Role check via `user_roles` table
- Admin: full access to all pages
- Moderator: payments, expenses, reports, audit logs (scoped to assigned buildings)
- User: my-apartments view only

### UI Patterns
- shadcn/ui Dialog for create/edit forms
- AlertDialog for confirmations
- Table-based list views
- Cards for dashboard navigation
- Toast notifications (sonner + radix toast)
- Gradient background: `bg-gradient-to-br from-primary/5 via-background to-secondary/10`
- All pages have "Back to Dashboard" button
- Loading state: centered spinner text

### Environment Variables

**Frontend (.env):**
- `VITE_API_URL` - API base URL (defaults to `/api`)
- `VITE_TURNSTILE_SITE_KEY` - Cloudflare Turnstile key

**Server (server/.env):**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Min 32 chars
- `JWT_ACCESS_EXPIRY` - Default "15m"
- `JWT_REFRESH_EXPIRY` - Default "7d"
- `PORT` - Server port (default 3000, dev uses 4010)
- `CORS_ORIGIN` - Allowed origin (default http://localhost:8080)
- `RESEND_API_KEY` - Email provider
- `DB_SSL` - true/false/no-verify
- `POW_DIFFICULTY` - Proof-of-Work difficulty (default 19)

## Common Tasks

### Adding a new page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx` (above the catch-all)
3. Add navigation card in `Dashboard.tsx` (admin/moderator/user cards)
4. Add all translation keys to `src/lib/i18n.ts` (he, ar, en)

### Adding a new database table
1. Create schema file in `server/src/db/schema/`
2. Export from `server/src/db/schema/index.ts`
3. Run `npm run db:generate` then `npm run db:migrate`

### Adding a new API endpoint
1. Create/update route file in `server/src/routes/`
2. Create/update service in `server/src/services/`
3. Mount route in `server/src/app.ts` if new file
4. Add Zod validation schemas

### Modifying financial calculations
- **ALWAYS** update `server/src/services/ledger.service.ts` and related services
- Test with: occupied apartments, vacant apartments, canceled payments, canceled expenses
- Verify credit recalculation after changes

## Important Notes
- `src/components/ui/` files are shadcn/ui generated - avoid manual edits
- Supabase is **no longer used** — all backend logic is in `server/`
- Currency is Israeli Shekel (₪)
- Standard rounding: `Math.round(x * 100) / 100` for all financial amounts
- Role updates use delete+insert pattern (not update)
- Docker deployment via `docker-compose.yml` (PostgreSQL + server + frontend build)
