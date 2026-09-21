# Milaap — Kumbh Mela Safety

Milaap is a demo missing-person reunification system for Kumbh Mela. Visitors submit a complaint and photos; the FastAPI service creates face embeddings and checks configured camera feeds. A potential match is saved, sent to the nearest authority by SMS, and surfaced in the admin and authority dashboards.

## Repository layout

- `milaap-backend/`: FastAPI service, face detection, PostgreSQL/pgvector access, CSV importer, and database schema.
- `milaap-dashboard/`: Next.js dashboard for visitors, administrators, and authorities.

## Prerequisites

- Python 3.10 or later.
- Node.js 20 or later.
- PostgreSQL/Neon with the `vector` extension enabled.
- Optional: Twilio credentials to send SMS. Alerts are still recorded if Twilio is not configured.

## Backend setup

```powershell
cd milaap-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set the values in `.env`. Generate a bcrypt hash for the administrator password instead of putting a raw password in the file:

```powershell
python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```

Create the schema, then load the supplied location data. Run the importer from `milaap-backend` because it reads the CSV files relative to that directory.

```powershell
psql "$env:NEON_CONN_STRING" -f schema.sql
python import_data.py
```

Start the API with Uvicorn:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

`python main.py` remains a local convenience fallback, but `uvicorn main:app` is the documented command.

## Dashboard setup

```powershell
cd milaap-dashboard
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_WS_URL` to the API address. Add the dashboard origin (for example, `http://localhost:3000`) to the backend `ALLOWED_ORIGINS` list.

## Authentication and access

- Admin credentials are server-side environment values: `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`.
- Authorities are seeded with bcrypt hashes generated from `AUTHORITY_DEFAULT_PASSWORD` when `import_data.py` runs.
- The frontend stores the short-lived access token in tab-scoped `sessionStorage`; it is sent in the `Authorization` header to protected APIs.
- The browser WebSocket and MJPEG image stream include the short-lived token in their URL because those browser APIs cannot supply a custom Authorization header. Use HTTPS and avoid sharing these URLs in a real deployment.

## Camera configuration

The CSV importer loads all camera locations into the `cameras` table, but it deliberately does not invent video URLs. A camera is startable only after its source is configured server-side:

```sql
UPDATE cameras
SET stream_url = 'rtsp://camera.example/stream'
WHERE camera_name = 'Z1-C1';
```

For temporary demo overrides, set `CAMERA_SOURCE_OVERRIDES_JSON` to a JSON object mapping camera names to sources. Stream URLs are never returned by the camera-list API.

## Tests and checks

```powershell
cd milaap-backend
pytest

cd ..\milaap-dashboard
npm run lint
npm test
```

## Demo limitations

This is a prototype. Face-matching thresholds, consent/privacy policy, secure camera infrastructure, rate limiting, audit logs, token revocation, and operational monitoring need production design before handling real personal data.
