# SPA hard refresh on production (Ctrl+R / deep links)

## Symptom

- In-app navigation works (React Router).
- **Hard refresh** on `/admin/issues`, `/admin/conventions`, etc. shows FortiGate **"Web Page Blocked"** (Attack ID **20000007**) or **500**.

## Cause

Hard refresh sends `GET /admin/...` to the server. The server must return **`index.html`** for that path (SPA fallback). If it returns 404/500, FortiGate may block the response.

Local dev works because Vite dev server always falls back to `index.html`.

## Fix on the server (pick one layout)

### A) Document root = `frontend/dist` (static SPA + API Alias)

1. Build frontend: `cd frontend && npm run build`
2. Deploy `frontend/dist/*` to the web root (includes `.htaccess` from `frontend/public/.htaccess`).
3. Ensure Apache allows overrides:

```apache
<Directory "/var/www/hrims-new/frontend/dist">
    AllowOverride All
    Require all granted
</Directory>
```

4. Optional (instead of `.htaccess`):

```apache
FallbackResource /index.html
```

5. Keep API on Laravel:

```apache
Alias /api /var/www/hrims-new/backend/public
```

### B) Document root = `backend/public` (Laravel handles everything)

1. `npm run build` in `frontend`
2. Copy build into Laravel public:

```bash
cp -r frontend/dist/* backend/public/
```

3. `GET /admin/*` goes through `index.php` → Laravel `web.php` fallback → `index.html`.

`web.php` also checks `../frontend/dist/index.html` if `public/index.html` is missing.

### After deploy

```bash
cd backend
php artisan route:clear
php artisan optimize:clear
```

Test in a **new tab** (hard refresh):

- `https://hrims.mohr.gov.pk/admin/issues`
- `https://hrims.mohr.gov.pk/admin/conventions`

You should get **200** and the HRIMS app shell (not FortiGate HTML).

## If still blocked (FortiGate Attack ID 20000007)

The WAF may block URLs containing `/admin/` even when the app is correct. Ask network/IT to **allow GET** for SPA routes on `hrims.mohr.gov.pk`, or exempt Attack ID **20000007** for this host.

Provide them:

- Legitimate paths: `/admin/*`, `/dashboard`, `/hr-requests`, etc. (all client-side routes)
- Method: **GET** / **HEAD** only for HTML shell
- API remains under `/api/v1/...`
