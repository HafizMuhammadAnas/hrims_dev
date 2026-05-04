# HRIMS Website — Step-by-Step Development Plan

This document complements **`DEVELOPMENT_GUIDE.md`**. Execute phases in order unless noted. Each step lists **validation** (how you know it is done) and **testing** (how to prove it works).

**Conventions:** Use **region / regional** terminology everywhere in new code (see the guide). Keep **`hrims_old/`** read-only for reference.

---

## How to use this plan

- **Gate:** Do not start the next phase until the current phase passes its validation and tests.
- **Automation:** Where “Automated” appears, add PHPUnit / Pest tests or frontend tests when the stack is ready; until then, use the manual checks.
- **Traceability:** Log blockers in your issue tracker with the phase id (e.g. `P3.2`).

---

## Phase 0 — Prerequisites

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **0.1** | Install PHP ≥ 8.2, Composer, Node.js LTS, npm, MySQL server, Git. | `php -v`, `composer -V`, `node -v`, `mysql --version` run successfully. | Manual: run each command; versions recorded in team wiki or README. |
| **0.2** | Apache with `mod_proxy`, `mod_proxy_fcgi`, `mod_rewrite` available (for Phase 12). | `httpd -M` or `apache2ctl -M` lists required modules (or plan for nginx alternative — not in current guide). | Manual: document host OS paths for your machine. |
| **0.3** | Create empty MySQL database and user with CRUD on that DB only. | Connection string works from CLI or GUI client. | Manual: `mysql -u user -p -e "USE hrims_dev; SELECT 1;"` succeeds. |

---

## Phase 1 — Repository layout

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **1.1** | Confirm `website/frontend/` and `website/backend/` (or equivalent) exist; `hrims_old/` untouched. | Folder structure matches **`DEVELOPMENT_GUIDE.md` §6**. | Manual: directory listing in repo. |
| **1.2** | Branching strategy (e.g. `main` + feature branches) and `.env` not committed. | `.gitignore` excludes `.env`, `node_modules`, `vendor`, `storage/logs`. | Manual: `git status` clean after clone + install. |

---

## Phase 2 — Laravel backend skeleton

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **2.1** | Create Laravel app in `website/backend` (or move project root as per guide). | `php artisan --version` works; `APP_KEY` set. | **Automated:** `php artisan test` (default Example test passes). **Manual:** open `/` or default welcome in browser if using `php artisan serve`. |
| **2.2** | Configure `.env`: `DB_*` → MySQL `hrims_dev`, `APP_URL` for local API. | `php artisan migrate:status` runs without DB errors (even if no migrations yet). | Manual: `php artisan db:show` or migrate status. |
| **2.3** | Set `SESSION_DRIVER` (e.g. `database` or `file` for dev). | Session config loads; if `database`, session table migrated when Laravel requires it. | Manual: after login exists (Phase 5), cookie persists; optional: `php artisan session:table` if using DB sessions. |

---

## Phase 3 — Core database schema (identity & geography)

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **3.1** | Migrations: `regions`, `departments` (and `districts` if needed early) with FK relationships as per ERD. | `php artisan migrate` succeeds; tables exist in MySQL. | **Automated:** migration smoke test or assertSchema. **Manual:** MySQL `SHOW TABLES; DESCRIBE regions;`. |
| **3.2** | Migration: `users` with `password`, `region_id` nullable, `department_id` nullable, `is_active`, timestamps. | Matches **`DEVELOPMENT_GUIDE.md`** §4.1 / §5. | **Automated:** User factory can create user. **Manual:** insert one user via tinker. |
| **3.3** | Migrations: `rbac_roles`, `rbac_permissions`, `rbac_role_permission`, `rbac_user_role` (or chosen pivot pattern). | All `rbac_*` tables present; FKs valid. | Manual: describe each table; `php artisan migrate:fresh` on dev DB only. |

---

## Phase 4 — RBAC seeding & authorization wiring

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **4.1** | Seeder: four roles — `federal_admin`, `regional_admin`, `department_admin`, `viewer`. | Rows in `rbac_roles` with correct slugs. | **Automated:** assertDatabaseHas in seeder test. **Manual:** `php artisan db:seed --class=RbacRoleSeeder`. |
| **4.2** | Seeder: baseline `rbac_permissions` and `rbac_role_permission` matrix (minimum set for first vertical slice). | Each role has expected permission rows. | **Automated:** test counts or spot-check pivot. **Manual:** SQL `JOIN` count by role. |
| **4.3** | User model: relationships to roles/permissions; helper `hasPermission()` or Laravel Gate registration. | Calling permission check in `tinker` returns expected booleans for seeded users. | **Automated:** unit tests for permission matrix for one federal and one regional user. **Manual:** `php artisan tinker` checks. |

---

## Phase 5 — Session-based authentication API

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **5.1** | Implement `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` under `routes/api.php` + `prefix('v1')`; use session guard / Sanctum SPA pattern per guide. | Unauthenticated `me` returns 401; login with valid user returns 200 + user JSON; logout clears session. | **Automated:** Feature tests with `actingAs` / session. **Manual:** Postman/Insomnia sequence (login → me → logout → me). |
| **5.2** | CSRF: SPA can obtain token (cookie or `/sanctum/csrf-cookie` if Sanctum) before state-changing requests. | Mutating requests fail without token, succeed with token. | **Automated:** test POST without/with CSRF. **Manual:** browser devtools Network tab. |
| **5.3** | Rate limiting on login route. | Too many failed attempts blocked or throttled. | **Automated:** assert rate limit response. **Manual:** rapid repeat login. |

---

## Phase 6 — Frontend scaffold (Vite + React + TS + Router)

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **6.1** | `npm create vite@latest` in `website/frontend` with React + TypeScript; install `react-router-dom`. | `npm run dev` serves app; `npm run build` succeeds. | **Automated:** `npm run build` in CI. **Manual:** open localhost port. |
| **6.2** | Folder layout: `src/api`, `components`, `pages`, `routes`, `styles`, `types` per guide. | Imports resolve; no circular dependency issues. | Manual: ESLint passes; optional `tsc --noEmit`. |
| **6.3** | Copy approved theme from `hrims_old/index.html` into `src/styles` (CSS variables + base layout classes). | Visual spot-check: colors match brown/blue/teal tokens. | **Manual:** side-by-side with `hrims_old` screenshot or running legacy app. |
| **6.4** | `vite.config.ts`: `server.proxy` `/api` → Laravel base URL (e.g. `http://127.0.0.1:8000`). | Frontend calls `/api/v1/...` without CORS errors in dev. | Manual: fetch `/api/v1/auth/me` from a test button shows 401 before login. |

---

## Phase 7 — Frontend authentication flow

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **7.1** | Login page UI (match legacy layout/theme); form posts to login API with credentials + CSRF handling. | After login, `me` returns user; session cookie set (`HttpOnly` as applicable). | **Manual:** login flow end-to-end in browser. **Automated:** Playwright/Cypress login happy path (optional). |
| **7.2** | Auth context/store: hold user; redirect unauthenticated users away from protected routes. | Direct navigation to protected route redirects to login. | **Manual:** paste protected URL while logged out. |
| **7.3** | Logout clears client state and calls logout API. | After logout, `me` is 401. | Manual: logout then refresh. |

---

## Phase 8 — App shell & navigation

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **8.1** | Layout: `Header`, `Sidebar`, main content area (ported from `hrims_old` structure, **region** labels). | Responsive behavior comparable to legacy (sidebar collapse if applicable). | Manual: resize window; compare with legacy. |
| **8.2** | React Router routes for dashboard placeholder and module placeholders; role-based menu visibility using user role from `me`. | Federal vs regional users see different menu items per policy (mirror legacy Sidebar rules). | Manual: log in as seeded federal vs regional test users. |

---

## Phase 9 — Domain schema & API (repeat per module)

Use this as a **template** for each business area: HR requests, federal groups, regional responses, compiled records, department tasks, violation entries, lookups (regions, districts, conventions, HRIMS categories).

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **9.m.1** | Migration(s) for module tables; FKs to `users`, `regions`, `departments` as needed. | `migrate` clean; Eloquent models exist. | **Automated:** model factory + unit test for fillable/guards. **Manual:** DB inspection. |
| **9.m.2** | Policy class registered; authorize `view`, `create`, `update`, `delete` with **region scope** + permissions. | Unauthorized user gets 403 on API. | **Automated:** policy tests with users in different regions. |
| **9.m.3** | `FormRequest` validation rules mirror legacy required fields (compare `hrims_old` forms). | Invalid payload returns 422 with field errors. | **Automated:** validation feature tests. |
| **9.m.4** | REST controllers under `Api/V1`; routes registered in `routes/api.php`. | Postman collection documents endpoints. | **Automated:** feature tests per endpoint (CRUD minimal). |
| **9.m.5** | Seeder (optional) from legacy `INITIAL_*` / `constants` for dev data. | Seeded data visible only to allowed roles. | Manual: UI + API with scoped user. |
| **9.m.6** | Frontend page(s): list/detail/forms calling API; loading and error states. | Matches approved styling; terminology **region/regional**. | **Manual:** CRUD walkthrough. **E2E (optional):** critical path. |

**Suggested module order (dependencies first):**

1. Lookups: regions, districts, conventions, categories (read-heavy).
2. HR requests + federal groups (core workflow).
3. Regional responses + department tasks.
4. Compiled records + violation entries + reporting.

---

## Phase 10 — File uploads (if required)

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **10.1** | Laravel storage disk; validation (mime, size); store path in DB; serve via controller or symlink `storage`. | Files persist; no path traversal. | **Automated:** upload test with invalid file rejected. **Manual:** download/open file. |
| **10.2** | Virus scan / policy (organizational) — document if deferred. | Stakeholder sign-off on risk if not implemented in v1. | Process checklist. |

---

## Phase 11 — Quality, security & performance baseline

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **11.1** | `APP_DEBUG=false` staging profile; no secrets in frontend bundle. | `grep` or build analysis shows no DB password in JS. | Manual: inspect `dist` assets. |
| **11.2** | HTTPS-only cookies in staging; secure headers (Apache or middleware). | Security scan or Mozilla Observatory spot-check. | Manual: SSL Labs / browser security tab. |
| **11.3** | Pagination on large list endpoints; indexes on FK and filter columns. | Explain plans reviewed for slow queries. | Manual: load test with realistic row counts (optional). |
| **11.4** | Backup & restore procedure documented for MySQL. | Restore drill successful on a copy. | Manual: restore to empty DB. |

---

## Phase 12 — Apache reverse proxy (Pattern B) — staging

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **12.1** | Build frontend: `npm run build`; deploy `dist` to static root Apache serves for `/`. | Single origin URL loads SPA. | Manual: open staging URL; hard refresh. |
| **12.2** | Proxy `/api` to PHP-FPM Laravel `public/index.php`. | `GET /api/v1/...` hits Laravel; static assets still served. | Manual: Network tab shows same host for HTML and API. |
| **12.3** | SPA fallback: unknown paths return `index.html` except `/api` and real files. | Direct URL to deep link (e.g. `/dashboard`) works after refresh. | Manual: paste deep link in new tab. |
| **12.4** | Session cookies on staging domain; login works through proxy. | Full login + API from production-like URL. | Manual: same as Phase 7 on staging host. |

---

## Phase 13 — User acceptance & go-live checklist

| Step | Tasks | Validation (done when) | Testing |
|------|--------|-------------------------|---------|
| **13.1** | UAT script: role × main workflow matrix (federal, regional, department, viewer). | Sign-off from product owner. | Manual: scripted UAT with checklist. |
| **13.2** | Data migration from legacy (if any): dry run on copy; reconcile counts. | Row counts and sample spot-checks match expectations. | Manual/SQL scripts documented. |
| **13.3** | Production deploy runbook: pull, `composer install --no-dev`, `php artisan migrate --force`, `npm ci && npm run build`, cache config, Apache reload. | Runbook executed on staging first. | Manual: dry run twice. |
| **13.4** | Monitoring: Laravel log rotation, MySQL backups, disk space alerts. | Alerts fire on test trigger. | Manual: verify notification channel. |

---

## Quick reference — minimum tests per phase

| Phase | Minimum bar before continuing |
|-------|-------------------------------|
| 2 | Laravel boots; DB connects; default tests pass. |
| 3 | `migrate` clean; core tables exist. |
| 4 | Roles seeded; permission checks work in code. |
| 5 | Login / logout / me + CSRF proven. |
| 6–7 | Browser login works with proxy. |
| 9 | Each module: policy 403 + happy-path CRUD API test. |
| 12 | Staging single-URL behavior matches production target. |

---

## Optional tooling (add when team is ready)

- **API:** Laravel Pest or PHPUnit feature tests for every `/api/v1` route.
- **Frontend:** Vitest + React Testing Library for hooks and forms; Playwright for E2E.
- **CI:** GitHub Actions / GitLab CI running `composer test` + `npm run build` + `npm run lint` on each push.

---

*Document version: 1.0 — aligns with `DEVELOPMENT_GUIDE.md`. Update phase numbers if you merge or split steps.*
