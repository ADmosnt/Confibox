# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Confibox is a logistics/distribution app for a Venezuelan candy distributor (Los Valles del Tuy area). It manages tiendas (delivery points), pedidos (orders), inventory by lotes (batches with expiration dates), and daily deliveries with GPS check-in. The frontend is a React SPA served as static files by the Flask backend in production.

## Common commands

### Backend (Python 3.12 + Flask)
```bash
cd backend
pip install -r requirements.txt
python run.py                    # dev server on :5000

# Seed test users + tiendas + pedidos (needs DATABASE_URL exported, NOT `railway run`)
python seed.py                   # idempotent insert of test data
python seed.py --clear           # delete TEST-* rows then re-insert
python seed.py --check           # list users + verify pass1234 hashes (read-only)
python seed.py --reset-passwords # reset test users' passwords to pass1234

python reset_data.py             # drop_all + create_all + recreate admin (destructive)
```

### Frontend (React 18 + Vite)
```bash
cd frontend
npm install
npm run dev                      # vite on :5173, proxies /api → :5000
npm run build                    # outputs to frontend/dist (consumed by Dockerfile)
```

### Docker / Production
```bash
docker compose up --build        # full stack with postgres + nginx (uses .env: DB_PASSWORD, SECRET_KEY)
```
Railway deploys via `Dockerfile` (multi-stage: builds React then copies `dist/` into the Flask image as `react_build/`). `gunicorn run:app` binds to `$PORT` (default 8080). Uploads are persisted on a Railway volume mounted at `/data/uploads` — set via `UPLOAD_DIR` env var.

## Architecture

### Backend layout (`backend/app/`)
- `__init__.py` — `create_app()` factory. Crucially: `_run_migrations()` runs raw `ALTER TABLE` statements on the **first HTTP request** (not Alembic). Schema changes go here as idempotent `ADD COLUMN IF NOT EXISTS` / `ALTER COLUMN TYPE` statements wrapped in `_init_db()` via `before_request`. Also seeds `admin/admin123` and the empty `ConfigEmpresa` row on first request.
- `models.py` — SQLAlchemy models. Note `Cliente` table is semantically a "tienda" (kept the table name for FK compatibility). `password_hash` is `VARCHAR(512)` to fit werkzeug 3.x scrypt hashes.
- `auth.py` — JWT (HS256, 24h expiry, `SECRET_KEY` env). `get_current_user()` reads `Authorization: Bearer <token>`. `@require_role(*roles)` is the authz decorator used everywhere — returns 401 if no/invalid token, 403 if role mismatch.
- `routes/` — one blueprint per domain, each registered under `/api/<prefix>` in `create_app()`. Cross-cutting patterns:
  - List endpoints accept query params (`?fecha=`, `?estado=`, `?chofer_id=`).
  - Choferes can hit shared list endpoints but the route auto-filters to `chofer_id == user.id` (see `routes/entregas.py:list_entregas`).
  - File uploads write to `_upload_dir()` (env `UPLOAD_DIR`, default `/data/uploads`); `GET /api/uploads/<filename>` serves them with path-traversal protection.

### Frontend layout (`frontend/src/`)
- `App.jsx` — route table. `RequireAuth roles={[...]}` enforces role-based access; the role list **must** match the backend's `@require_role` for each endpoint the page calls (a mismatch causes 403 like the chofer/entregas bug).
- `context/AuthContext.jsx` — JWT in `sessionStorage` (NOT localStorage), 15-min idle timeout with warning at 14 min, hooks `setUnauthorizedHandler` so the axios interceptor can force-logout on 401.
- `api/index.js` — axios instance with baseURL `/api`. The Vite dev server proxies this to `:5000`. The interceptor calls the unauthorized handler on 401 (except for the login endpoint itself) and shows a toast on network failures.
- `components/Layout.jsx` — sidebar nav defined per-role in the `NAV` map. Adding a route to `App.jsx` is not enough; also add it here for the role to see it.
- `components/MapaTiendas.jsx` — react-leaflet wrapper. **Critical**: any component using `useMap()` (e.g. `FitBounds`, `CenterButton`) MUST be a child of `<MapContainer>`, otherwise it throws `useLeafletContext()` errors that white-screen the page.
- `hooks/useOfflineSync.js` — chofer offline queue in `localStorage` (`confibox_sync_queue`). Reads queue fresh from `localStorage` inside `doSync` (not from React state) to avoid stale closures when triggered by `window.addEventListener('online', ...)`. `enqueue` writes synchronously to localStorage.
- `pages/MiRuta.jsx` — chofer's daily route. Caches the route in `localStorage` (`confibox_ruta_cache`) for offline reads. Optimistic UI via `localEstados` map overlaid on server `estado`; pending sync items shown via `pendingIds` from queue.

### Roles
Five roles drive routing and authz: `admin`, `vendedor`, `facturacion`, `almacenista`, `chofer`. The frontend `RequireAuth` and the backend `@require_role` must be kept in sync for each endpoint a page calls.

### Pedido / entrega state machine
`Pedido.estado`: `pendiente` → (facturacion) → `facturado` → (almacenista picking + iniciar-ruta) → `en_ruta` → (chofer checkin) → `entregado` | `con_incidencia` | `anulado`. Creating an `EntregaDiaria` is the side-effect of `iniciar-ruta`. The chofer's `/api/entregas/mi-ruta` filters to `Pedido.estado == 'en_ruta'` for their own user.

### Database & migrations
PostgreSQL only (psycopg2). The app supports the legacy `postgres://` URL scheme by rewriting it to `postgresql://`. There is no Alembic — schema migrations are raw SQL `ALTER TABLE` calls in `_run_migrations()` and must be **idempotent** (use `IF NOT EXISTS` / `IF EXISTS`). Tables are created via `db.create_all()` on first request.

### Test users (after running `seed.py`)
`admin/admin123` (auto-seeded); `vendedor1`, `facturacion1`, `almacenista1`, `chofer1`, `chofer2` all with password `pass1234`. `chofer1` has `PED-2024-003` assigned `en_ruta` for testing the delivery flow.

## Gotchas

- **`railway run python seed.py` does not work** — Railway injects its internal DB URL (`postgres.railway.internal`) which is not reachable from outside. Run `python seed.py` directly with `DATABASE_URL` set to the public proxy URL.
- **react-leaflet pinned to `^4.2.1`** — v5 requires React 19 and breaks the Docker build under React 18.
- **Permissions-Policy header** is set in `__init__.py:_security_headers` to `geolocation=(self), camera=(self)`. Setting `camera=()` blocks the camera API on mobile (used by check-in photo evidence and tienda fachada photos).
- **Rate limiter** on `/api/auth/login` is `10 per minute; 50 per hour`. Hammering login during testing returns 429, not 401.
- **Werkzeug is pinned** (`werkzeug==3.0.3`) so the seed and runtime use the same scrypt format. Don't unpin without verifying hash compatibility.
- **Develop on the branch specified by the task** (currently `claude/lacorom-analysis-o6VYm`). The Railway service deploys from this branch.
