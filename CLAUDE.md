# Al-Bayt Manager - Building Management System

## Project Overview
Multi-tenant building management system for managing residential buildings, apartments, payments, expenses, and tenants. Built for an Israeli market (shekel currency ₪), supporting Arabic, Hebrew, and English.

**Company:** qFiber LTD (qfiber.co.il)
**Origin:** Initially scaffolded with Lovable.dev, now maintained manually.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite (SWC compiler)
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **State:** React Query (@tanstack/react-query) for server state, React Context for auth/language
- **Forms:** react-hook-form + zod
- **Charts:** Recharts
- **Icons:** lucide-react
- **Date:** date-fns (but many pages use manual date parsing)

## Development
```bash
npm run dev       # Start dev server on port 8080
npm run build     # Production build
npm run lint      # ESLint
```

## Project Structure
```
src/
├── App.tsx                    # Router setup, provider hierarchy
├── main.tsx                   # Entry point
├── contexts/
│   ├── AuthContext.tsx         # Auth state, role checks (admin/moderator), sign in/out
│   └── LanguageContext.tsx     # i18n context, RTL support
├── components/
│   ├── ui/                    # shadcn/ui components (DO NOT edit manually)
│   ├── GeneralInformationCard.tsx
│   ├── GeneralInformationDialog.tsx
│   └── NavLink.tsx
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/supabase/
│   ├── client.ts              # Supabase client init
│   └── types.ts               # Auto-generated DB types (DO NOT edit manually)
├── lib/
│   ├── auditLogger.ts         # Audit event logging via RPC
│   ├── i18n.ts                # Translation strings (he/ar/en)
│   └── utils.ts               # cn(), date format helpers
├── pages/
│   ├── Auth.tsx               # Login + 2FA + CAPTCHA
│   ├── Register.tsx           # User registration
│   ├── Setup2FA.tsx           # 2FA setup flow
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
│   └── NotFound.tsx
supabase/
├── functions/
│   ├── api/index.ts           # Read-only REST API with API key auth
│   ├── create-user/index.ts   # Admin user creation
│   ├── delete-user/index.ts   # Admin user deletion
│   ├── change-user-password/  # Admin password change
│   ├── disable-user-2fa/      # Admin 2FA disable
│   ├── send-templated-email/  # Multi-language email sending
│   └── verify-turnstile/      # CAPTCHA verification
└── migrations/                # 35+ SQL migrations
```

## Database Schema (Key Tables)
- **buildings** - Building records (name, address, floors, logo)
- **apartments** - Apartment units (building_id, status, credit, subscription_amount, owner_id, beneficiary_id)
- **payments** - Monthly payments (apartment_id, month, amount, is_canceled)
- **expenses** - Building expenses (building_id, amount, category, recurring support)
- **apartment_expenses** - Per-apartment expense allocations (amount, amount_paid, is_canceled)
- **payment_allocations** - Payment-to-expense allocation audit trail
- **profiles** - User profiles (name, phone, preferred_language)
- **user_roles** - Role assignments (admin/moderator/user)
- **user_apartments** - User-apartment assignments (1:1)
- **moderator_buildings** - Moderator-building assignments
- **settings** - System settings (monthly_fee, language, SMTP config)
- **public_branding** - Public-facing branding (logo, company name, turnstile config)
- **audit_logs** - Activity audit trail
- **email_templates** / **email_template_translations** - Email template system
- **email_logs** - Email delivery history
- **api_keys** - API key hashes
- **general_information** - Dashboard info cards

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

### Authentication & Roles
- 3 roles: `admin`, `moderator`, `user`
- Role check via `user_roles` table (not Supabase built-in roles)
- Admin: full access to all pages
- Moderator: payments, expenses, reports, audit logs (scoped to assigned buildings)
- User: my-apartments view only
- 2FA via Supabase TOTP MFA
- CAPTCHA via Cloudflare Turnstile

### UI Patterns
- shadcn/ui Dialog for create/edit forms
- AlertDialog for confirmations
- Table-based list views
- Cards for dashboard navigation
- Toast notifications (sonner + radix toast)
- Gradient background: `bg-gradient-to-br from-primary/5 via-background to-secondary/10`
- All pages have "Back to Dashboard" button
- Loading state: centered spinner text

### Supabase Edge Functions
- Written in TypeScript (Deno runtime)
- Use service role key for admin operations
- CORS headers included
- Accessed via `supabase.functions.invoke()`

### Environment Variables
- `VITE_SUPABASE_URL` - Supabase API URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Project ID
- `VITE_TURNSTILE_SITE_KEY` - Cloudflare Turnstile key

## Common Tasks

### Adding a new page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx` (above the catch-all)
3. Add navigation card in `Dashboard.tsx` (admin/moderator/user cards)
4. Add all translation keys to `src/lib/i18n.ts` (he, ar, en)

### Adding a new database table
1. Create migration in `supabase/migrations/`
2. Regenerate types (update `src/integrations/supabase/types.ts`)
3. Add RLS policies as needed

### Modifying financial calculations
- **ALWAYS** update `server/src/services/ledger.service.ts` and related services
- Test with: occupied apartments, vacant apartments, canceled payments, canceled expenses
- Verify credit recalculation after changes

## Important Notes
- `src/components/ui/` files are shadcn/ui generated - avoid manual edits
- `src/integrations/supabase/types.ts` is auto-generated from DB schema
- Currency is Israeli Shekel (₪)
- Standard rounding: `Math.round(x * 100) / 100` for all financial amounts
- Role updates use delete+insert pattern (not update)
- The `.env` file is committed (contains only public keys)
