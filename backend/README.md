# CareSync Backend (FastAPI)

Modular backend starter for the CareSync healthcare platform.

## Stack
- Python 3.12
- FastAPI
- SQLAlchemy 2.0 (async, PostgreSQL via `asyncpg`)
- Alembic
- JWT auth

## Architecture

Flow:
`Router -> Service -> Models/DB`

Structure:
- `app/main.py` app bootstrap + health check
- `app/api/router.py` central module registration
- `app/api/deps.py` auth + role guards
- `app/core/` settings + security
- `app/db/` base and session
- `app/models/` shared entities
- `app/modules/auth` login/register
- `app/modules/patients` patient dashboard, profile, privacy controls
- `app/modules/gp` GP dashboard, visits, referrals, medication
- `app/modules/specialist` notes, lab referral, medication
- `app/modules/lab` lab orders and report upload
- `app/modules/pharmacy` medication queue and dispense
- `alembic/` migration bootstrap

## Quick Start

```bash
cd backend
cp .env.example .env
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
alembic upgrade head
uvicorn app.main:app --reload
```

If you accidentally created `path/to/venv` inside `backend`, remove it first:

```bash
rm -rf path
```

API docs:
- `http://127.0.0.1:8000/docs`

## Example API Flow

1. `POST /api/v1/auth/register` for each role.
2. `POST /api/v1/auth/login` to get bearer token.
3. Patient updates profile via `PUT /api/v1/patients/me/profile`.
4. GP logs visit and referrals (`/api/v1/gp/*`).
5. Specialist adds notes/medication (`/api/v1/specialist/*`).
6. Lab uploads reports (`/api/v1/lab/reports`).
7. Pharmacy dispenses medication (`/api/v1/pharmacy/medications/dispense`).
8. Patient hides a visit with `PATCH /api/v1/patients/me/visits/{visit_id}/visibility`.

## Notes
- Default DB is PostgreSQL async: `postgresql+asyncpg://postgres:postgres@localhost:5432/caresync`.
- Create the DB first (example): `createdb caresync`
- Schema is managed by Alembic migrations (not `create_all` at app startup).
- Configure frontend origin(s) in `.env` via `CORS_ORIGINS` (comma-separated).
- JWT config is in `.env`; rotate secrets before deployment.

## Wallet Issuer Credentials
- Apple Wallet and Google Wallet issuer credentials are not checked into git.
- Put issuer files under `backend/credentials/` and configure paths in `backend/.env`.
- Setup guide: [credentials/README.md](/Users/azzu/Documents/caresync/backend/credentials/README.md)
