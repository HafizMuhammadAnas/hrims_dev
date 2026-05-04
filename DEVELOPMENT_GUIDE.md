# HRIMS Website — Development Guide

This document refines the technical plan for rebuilding HRIMS under `website/` while **`hrims_old/` remains the approved UI reference and read-only legacy codebase**. Follow it for backend (Laravel + MySQL), frontend (React + TypeScript + Vite + React Router), deployment (Apache), and authorization.

**Terminology:** The new application uses **region** / **regional** everywhere (UI, API, database, code). The legacy prototype used “province” / “provincial”; treat those as the same concept only when reading `hrims_old/` — do **not** carry that wording into `website/`.

**Related:** **`DEVELOPMENT_PLAN.md`** — phased step-by-step execution order with **validation** and **testing** criteria for each step.

---

## 1. Guiding principles

| Principle | Detail |
|-----------|--------|
| **Single public URL in production** | Users see one host (e.g. `https://hrims.example.gov.pk`). The browser loads the SPA and calls APIs on the **same origin** under `/api/v1/...`, so cookies and CSRF stay simple. |
| **Two processes in local development** | Vite dev server (frontend) + Laravel/Apache or `php artisan serve` (API). Use a **Vite proxy** so the browser talks to one port, or configure CORS + `SESSION_DOMAIN`/cookie settings carefully if you use two origins in dev. |
| **Do not edit `hrims_old/`** | Copy patterns, colors, and layout from there; implement new code only under `website/`. |
| **API contract first** | REST JSON under `/api/v1/`. Version in the path so breaking changes can add `/api/v2/` later. |
| **Server-side authorization** | Every mutating and sensitive read operation must be checked in Laravel (Policies/Gates). The React app only hides UI; **never** trust it for security. |

---

## 2. Roles from the legacy application (`hrims_old`)

Source: `hrims_old/types.ts` — `UserRole` enum (legacy naming). **New system naming** in parentheses.

| Role key — **new app (preferred)** | Legacy `hrims_old` value | Display / meaning (from UI usage) | Typical scope |
|--------------------------------------|--------------------------|-----------------------------------|---------------|
| `federal_admin` | `federal_admin` | Federal Ministry administrator | National: all regions, federal requests, federal user management, compilation flows. |
| `regional_admin` | `provincial_admin` | Regional focal person | One region: incoming requests, distribution to departments, monitoring, regional user management. |
| `department_admin` | `department_admin` | Department user | Region + **department**: assigned tasks, submissions; may appear under `region: 'Federal'` for federal department demos in legacy. |
| `viewer` | `viewer` | Read-only | Legacy: used for read-only / limited UI (e.g. federal scope viewers in `mockDb.getUsersByScope`). |

**Refinement:** The old app encodes **data scope** in the user row (`province` in legacy → **`region`** in the new schema, plus `departmentId`, `departmentName`), not only the role. RBAC should therefore combine:

- **Role** → which *kind* of actions are allowed (Policies + permissions).
- **Tenant scope** → which rows are visible (**`region`**, department linkage). Express as foreign keys on `users` (e.g. `region_id`, `department_id`) and always filter queries by the authenticated user’s scope.

Seed these four roles into `rbac_roles` with the **new** slugs (`regional_admin`, not `provincial_admin`). If you import legacy data, map `provincial_admin` → `regional_admin` during migration.

---

## 3. Authentication: sessions and cookies

**Choice:** Laravel **session** authentication (cookie-based session ID), **not** JWT in `localStorage`, for alignment with your requirement and simpler CSRF handling for a same-origin SPA.

**Recommended approach:**

- **Laravel Sanctum (SPA authentication)** with `sanctum`’s cookie + session flow **or** classic `web` guard + `EnsureFrontendRequestsAreStateful` if you use Sanctum’s SPA docs — **or** a minimal custom stack: `web` routes for `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` using `Auth::attempt()` / `Auth::logout()` / `Auth::user()` with `SESSION_DRIVER=database` or `redis` in production.

**Requirements:**

- `SESSION_SECURE_COOKIE=true` in production (HTTPS).
- `SameSite=Lax` or `Strict` as appropriate; **same site** for SPA + API when using Pattern B (same hostname).
- **CSRF:** Laravel’s `VerifyCsrfToken` — SPA must read `XSRF-TOKEN` cookie or call a route that returns a CSRF token before mutating requests.
- **CORS:** In production with one origin, CORS is trivial. In dev (Vite on `:5173`, API on another port), either proxy through Vite or enable CORS for credentials with an explicit allowlist.

**Passwords:** Store only **hashes** (`bcrypt`/`argon2` via Laravel Hash). The legacy `mockDb.authenticate(username)` had **no password** — the new system must add `password` (and optional `email_verified_at`, `last_login_at`, etc.) on the real `users` table.

---

## 4. RBAC: tables, naming, and Laravel Policies

### 4.1 Your `rbac_` prefix — refined layout

You asked for RBAC-related tables with an **`rbac_` prefix**. Laravel also needs a **`users`** (or equivalent) table for identities. Recommended split:

| Table | Purpose |
|-------|---------|
| **`users`** | Laravel canonical: `id`, `name`, `email`/`username`, `password`, `remember_token`, timestamps, plus **scope**: `region_id` nullable, `department_id` nullable, `is_active`, etc. *(Not prefixed `rbac_` — this is standard Laravel and avoids fighting the framework.)* |
| **`rbac_roles`** | `id`, `slug` (`federal_admin`, `regional_admin`, …), `name`, `description`, timestamps. |
| **`rbac_permissions`** | `id`, `slug` (e.g. `requests.create`, `requests.view-all`, `responses.review`), `name`, `description`. |
| **`rbac_role_permission`** | `role_id`, `permission_id` (pivot). |
| **`rbac_user_role`** | `user_id`, `role_id` (pivot). If each user has exactly one role, a nullable `role_id` on `users` is enough; pivot supports **multiple roles** later without migration pain. |

**Optional:** `rbac_model_has_permissions` if you need object-level ACLs later; start simple with role + permission + Policies.

### 4.2 Policies (authorization) per domain model

Map Laravel **Policies** to Eloquent models that mirror legacy entities (see §5). Use **region**-based names in the new codebase (legacy `ProvinceResponse` → e.g. `RegionResponse`). Examples:

| Model (Eloquent) | Policy focus |
|------------------|--------------|
| `User` | Who may create/update/delete users; scope by federal vs regional admin; protect root/system users. |
| `HrRequest` (or your name) | Federal vs regional visibility; create/update/delete rules. |
| `RegionResponse` | Review actions, region match. |
| `FederalGroup` | Federal admin vs read for others. |
| `CompiledRecord` | Compilation workflow. |
| `DepartmentTask` | Department user sees only own department; regional admin sees region. |
| `ViolationEntry` | Region (and district) scope; CRUD rules. |

**Pattern:** In each policy method, call a small helper or use permissions: `$user->can('requests.view-all')` **and** assert `$model->region_id` matches the user’s allowed regions (or “all” for federal admin).

**Seeding:** Seed the four roles, then seed **role–permission** matrix** in code** (version-controlled) so authorization rules stay reviewable in PRs.

---

## 5. Domain data: from `mockDb` and TypeScript sources → MySQL schema

### 5.1 Entities persisted in legacy `MockDatabase` (`hrims_old/services/mockDb.ts`)

These should become first-class tables (names are suggestions — use your naming convention, singular table names with Laravel are common). **Prefer region terminology** in table and column names.

| Legacy concept | Suggested table / notes |
|----------------|-------------------------|
| `User` | `users` + FKs to **`regions`**, `departments`, `rbac_roles` / pivot. |
| `HRRequest` | e.g. `hr_requests` — target field: **`region`** (legacy `prov`) + `issue_cards` JSON or normalized child tables if you need reporting. |
| `FederalGroup` | `federal_groups` + pivot `federal_group_request` (`federal_group_id`, `hr_request_id`) instead of `linkedRequests[]`. |
| `ProvinceResponse` (legacy) | **`regional_responses`** (or `region_responses`) — model **`RegionResponse`**; columns use **`region`**, not `province`. |
| `CompiledRecord` | `compiled_records` — **`regions[]`** as JSON or pivot **`compiled_record_region`**. |
| `DepartmentTask` | `department_tasks`. |
| `ViolationEntry` | `violation_entries` — **`region_id`** / **`region`** + district fields as needed. |

### 5.2 Reference / catalog data (mostly in `constants.ts` and other TS files)

Not all of this lived in `mockDb`, but the app depends on it — migrate to DB or versioned JSON seeds as you prefer:

| Source file (legacy) | Content |
|----------------------|---------|
| `constants.ts` | `CONVENTIONS`, `CONVENTION_RECOMMENDATIONS`, `INDICATORS`, `SDGS`, `UPR_STATS`, `UPR_REQUEST_CYCLES`, `SDG_INDICATOR_OPTIONS`, departments list, large `INITIAL_*` seeds. |
| `hrimsCategories.ts` | HRIMS category hierarchy for forms and tasks. |
| `provinceDistricts.ts` | Legacy name: province/district geography. **New app:** equivalent module e.g. **`regionDistricts.ts`** / tables **`regions`**, **`districts`** with `region_id` FK. |
| `violationCategories.ts` | Violation taxonomy. |

**Refinement:** Put **master data** (conventions, **regions**, districts, SDG/UPR option catalogs) in **read-mostly tables** or import via **Laravel seeders** once; keep **transactional** data (requests, responses, tasks) normalized in operational tables.

### 5.3 Migrations workflow

1. Design ERD from `hrims_old/types.ts` interfaces + `mockDb` collections — **rename** province-oriented fields to region-oriented names in the new schema.
2. Laravel migrations in `database/migrations/` — create lookup tables before FKs.
3. Artisan seeders to import **initial rows** from `constants.ts` / `INITIAL_*` where the client expects default catalog data (map legacy “province” labels to **region** records as needed).
4. Optional one-off script to compare counts with legacy UI (manual QA checklist).

---

## 6. Folder structure (target)

```
website/
  DEVELOPMENT_GUIDE.md          # this file
  frontend/                     # React + TS + Vite + React Router
    public/
    src/
      api/                      # fetch wrappers, /api/v1 base URL, CSRF helpers
      assets/
      components/               # shared UI (match hrims_old patterns)
      hooks/
      layouts/
      pages/
      routes/
      styles/                   # global CSS variables copied from approved theme
      types/
      main.tsx
    index.html                  # link global theme (see §8)
    vite.config.ts              # dev proxy → Laravel /api
    package.json
  backend/                      # Laravel application root (or repo subfolder)
    app/
      Http/Controllers/Api/V1/
      Models/
      Policies/
      Http/Requests/            # FormRequest validation per endpoint
    routes/
      api.php                   # prefix api/v1
    database/migrations/
    database/seeders/
```

**Refinement:** Laravel’s default is project root = backend. If `backend/` is the Laravel root, run `composer create-project` **inside** `website/backend` so `artisan` and `public/` live there. Apache `DocumentRoot` for PHP in dev can point to `backend/public`.

---

## 7. REST API scaffold: `/api/v1/...`

### 7.1 Conventions

- **Prefix:** All JSON API routes: `Route::prefix('v1')->group(...)` inside `routes/api.php` with overall prefix `api` (Laravel default) → **`/api/v1/...`**.
- **Plural nouns** for collections: `GET /api/v1/hr-requests`, `GET /api/v1/hr-requests/{id}`.
- **Verbs as sub-resources** when needed: `POST /api/v1/hr-requests/{id}/responses` — only if it keeps clarity; otherwise stick to RESTful resource controllers.
- **Consistent envelope (optional):** Either raw resources or `{ "data": ... }` — pick one and document it in this guide once chosen.
- **Errors:** HTTP status codes + JSON `{ "message": "...", "errors": { ... } }` for validation (422).

### 7.2 Suggested route groups (iterate as features land)

| Area | Examples |
|------|----------|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `GET /api/v1/auth/csrf` (if needed). |
| Users / RBAC admin | `apiResource` for users under admin policy; `GET /api/v1/roles`, `GET /api/v1/permissions` (read-only for UI pickers). |
| Core HRIMS | `hr-requests`, `federal-groups`, **`region-responses`** (not `province-responses`), `compiled-records`, `department-tasks`, `violation-entries`. |
| Lookups | **`regions`**, `districts`, `conventions`, `hrims-categories`, … |

**Controllers:** `App\Http\Controllers\Api\V1\HrRequestController` — keeps namespaces aligned with URL version.

---

## 8. UI / UX and color theme (client-approved)

**Source of truth:** `hrims_old/index.html` — the `<style>` block defines **CSS variables** (`:root`) for brown / blue / teal theme, table headers, sidebar, dashboard cards, buttons (`.btn`, `.btn-primary`, …), and layout classes (`.header`, `.sidebar`, `.nav-item`, …).

**Action items for `website/frontend`:**

1. Copy the **`:root` variable block** and **shared layout/component CSS** into the new app (e.g. `src/styles/theme.css` imported from `main.tsx`), or reproduce with Tailwind **`@theme`** / config using the **exact hex/rgb** values from legacy.
2. Reuse **spacing, typography, and component structure** from `hrims_old/components/` (`Layout`, `Header`, `Sidebar`) when rebuilding pages — same look, new data layer via API. **Copy and adjust copy:** replace user-facing strings “Province” / “Provincial” with **“Region” / “Regional”** in labels, headings, and nav.
3. The legacy app uses **Tailwind via CDN** in `index.html`; the new Vite app typically uses **Tailwind as a PostCSS dependency** for production builds. **Either** is fine if **computed styles match the approved palette**; prefer build-time Tailwind for production consistency.

---

## 9. Production deployment: Pattern B (Apache reverse proxy)

**Goal:** One hostname; static SPA + PHP (Laravel) behind Apache.

| Path / condition | Handler |
|------------------|---------|
| `/api/*` | Forward to **PHP-FPM** (Laravel `public/index.php`). Laravel handles `/api/v1/...`. |
| Static files (`/assets/*`, `favicon`, etc.) | Serve files from **`frontend/dist`** (Vite build output). |
| SPA fallback | For non-file routes, serve **`index.html`** from `dist` so React Router handles client-side routes. |

**Implementation notes:**

- Apache modules: `mod_proxy`, `mod_proxy_fcgi`, `mod_rewrite` (and optionally `mod_headers` for security headers).
- Laravel `APP_URL` must match the public URL; `ASSET_URL` if assets are on a CDN later.
- Do **not** expose `backend/.env` or `storage/` contents; document root should only be `public/`.
- **Build pipeline:** `npm ci && npm run build` in `frontend/` → deploy `dist/` contents to the static directory Apache serves for `/`.

**Development shortcut:** Vite `server.proxy` in `vite.config.ts` forwarding `/api` to `http://127.0.0.1:8000` (or your local Apache vhost) so the team rarely touches CORS.

---

## 10. Development phases (recommended order)

1. **Laravel skeleton** in `website/backend` — MySQL connection, migrations for `users` + all `rbac_*` tables, session config.
2. **Auth + CSRF + `/api/v1/auth/me`** — login/logout; Postman or minimal React page to verify cookies.
3. **Seed roles & permissions** — wire Policies to one resource (e.g. `HrRequest`).
4. **Vite React app** — theme CSS, layout shell matching `hrims_old`, React Router routes mirroring main nav (**region** wording in UI).
5. **Migrations for core domain** — hr_requests, **region** responses, tasks, violations, federal groups, compiled records.
6. **Seeders** from legacy `INITIAL_*` / constants where needed (with field mapping province → region where applicable).
7. **CRUD API v1** per module + frontend screens consuming APIs.
8. **Apache staging** — rehearse Pattern B on a staging host before production.

---

## 11. Corrections and clarifications to the original plan

| Topic | Refinement |
|-------|------------|
| **“Tables for users with rbac_ prefix”** | Use Laravel-standard **`users`** for authentication; use **`rbac_`** for roles, permissions, and pivots. This keeps Laravel’s `Authenticatable` and community docs aligned. |
| **“Merge two servers in production”** | Merge at the **HTTP edge** (Apache), not by combining codebases into one repo folder. Frontend is **static build**; backend is **Laravel**; one vhost ties them together. |
| **ORM “or” PDO** | Laravel **Eloquent** is the default; use **Query Builder** where raw performance matters. No need for raw PDO unless you have a special case. |
| **Policies “for each model”** | Yes — one Policy class per main Eloquent model; optionally Gate aliases for cross-cutting checks. |
| **RBAC vs row scope** | Permissions say *what*; **`region_id`** / `department_id` say *which rows*. Both are required for correct behavior. |
| **Province vs region** | **`hrims_old`** uses province/provincial in types and UI. The **new** stack must standardize on **region/regional** in DB columns, API JSON, TypeScript types, and user-visible text to avoid repeating the wrong term. |

---

## 12. Open decisions (fill in as you implement)

Record answers here as the team decides:

- [ ] **Username vs email** for login (legacy uses `username`).
- [ ] **Password reset** and account invitation flow.
- [ ] **Audit log** table for sensitive actions (recommended for government systems).
- [ ] **File uploads** (requests, tasks, attachments) — local disk vs S3-compatible storage.
- [ ] **Apache vs Laravel Octane** later — not required for v1.

---

*Document version: 1.1 — terminology standardized on **region** / **regional** for the new application; legacy `hrims_old` naming described only where needed for migration. Update this file when API envelope, auth package (Sanctum vs pure session), or deployment host details are finalized.*
