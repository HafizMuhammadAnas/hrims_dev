# HRIMS website (new stack)

Laravel API under `backend/`, React (Vite) SPA under `frontend/`. See `DEVELOPMENT_GUIDE.md` and `DEVELOPMENT_PLAN.md`.

## Local setup

### 1. MySQL

Create database and grant access, then set `website/backend/.env`:

- `DB_DATABASE=hrims_dev`
- `DB_USERNAME` / `DB_PASSWORD` (root often requires a password on Windows)

### 2. Backend

```powershell
cd website/backend
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```

After pulling new backend changes, run `migrate` or `migrate:fresh --seed` again so domain tables (`hr_requests`, `federal_groups`, `regional_responses`, etc.) exist and demo data loads from `HrimsDataSeeder`.

Seeded dev user: username `federal`, password `password` (change immediately outside local dev).

### 3. Frontend

```powershell
cd website/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` and `/sanctum` to `http://127.0.0.1:8000`, so session cookies work without manual CORS setup.

### Composer on PATH

If `composer` is not installed globally, this repo may include `composer.phar` under `website/` — use `php composer.phar` in `website/backend` for package commands.

### PHP zip extension (optional)

Enabling `extension=zip` in `php.ini` speeds up Composer installs (dist downloads).
