# CareSyncAI

CareSyncAI is a full-stack digital healthcare platform designed to connect patients, GPs,
specialists, labs, and pharmacies through one consent-aware system. The product combines
QR-based patient identity, shared clinical workflows, patient-controlled record visibility,
health-data syncing, and AI-assisted care planning in a single web application.

The repository is split into two top-level applications:

- `frontend/`: React, TypeScript, and Vite client
- `backend/`: FastAPI, SQLAlchemy, and PostgreSQL service

## What The Project Does

CareSyncAI focuses on reducing fragmented care journeys and repeated paperwork by giving each
participant in the healthcare flow access to the right information at the right time.

Core product goals:

- Centralize patient records across GP, specialist, lab, and pharmacy workflows
- Let patients share limited or full records through consent-aware access controls
- Replace paper-heavy identity checks with QR-based digital health cards
- Reduce clinician admin overhead and speed up patient handling
- Provide AI-assisted health guidance, diet planning, exercise planning, and activity analysis

## Key Features

### 1. Patient onboarding and digital identity

- Patient self-registration with NHS healthcare ID, profile, consent, and login
- QR-based digital health card generation for scanning, downloading, and sharing
- Patient dashboard showing profile, health card, and latest health-history updates
- Role-aware access so each user only sees relevant patient context

### 2. Consent-aware record sharing

- Patients can control visibility of visits and other health-history records
- Support for both selective and bulk history access updates
- Shared access model across GP, specialist, lab, and pharmacy workflows
- Fine-grained visibility flags on visits, reports, and medications

### 3. Multi-role healthcare workflows

Implemented roles:

- `patient`
- `gp`
- `specialist`
- `lab`
- `pharmacy`

Supported workflows:

- GP dashboard with patient lookup, visit logging, specialist referrals, lab referrals, and medication prescribing
- Specialist workflow for notes, lab referrals, and medication updates
- Lab dashboard for reviewing open orders and uploading report summaries and files
- Pharmacy dashboard for medication queue management and dispense actions
- Patient history view combining visits, lab reports, and medications

### 4. AI-assisted patient support

Two AI layers are implemented in the backend:

- `ai_assistant`: classic chat, exercise planner, and diet planner APIs
- `agentic`: structured agent conversations, care plans, plan check-ins, conversation management, and calendar-aware responses

Implemented AI capabilities:

- Health Q and A chat with optional medical-history, medication, and health-metric context
- AI-generated diet plans with calorie and macro breakdowns
- AI-generated exercise schedules with intensity, duration, and safety notes
- Agentic medical, exercise, and diet conversations
- Persistent care plans with plan items, overrides, check-ins, and daily summaries
- Calendar integration for AI-generated exercise and diet plans

### 5. Health data import and activity sync

- Manual metric logging for steps, active minutes, distance, sleep, and calories
- Health-data file upload support for `csv`, `json`, and Apple Health `xml`
- Apple Health and Google Fit provider tracking
- Imported file provenance and metric-source metadata
- Conflict protection to avoid mixing competing activity sources for the same date
- Activity overview and recent health-metric summaries for patient analysis

### 6. Calendar and content features

- Patient calendar CRUD for appointments, diet, exercise, and custom events
- Sync generated exercise schedules into the calendar
- Static health tips content module exposed through the API

## Architecture

The backend follows a modular structure with a clear flow:

`Router -> Service -> Models/DB`

High-level architecture:

- `frontend/` handles routing, authenticated dashboards, QR card rendering, AI workspaces, and patient/staff user flows
- `backend/app/api/router.py` registers all modules under `/api/v1`
- `backend/app/modules/` separates business domains such as auth, patients, gp, lab, health data, and AI
- `backend/app/models/` contains both healthcare-domain models and agentic-care-plan models
- `backend/media/` stores uploaded health-data and report files

Backend modules:

- `auth`: registration, login, current-user session
- `patients`: patient profile, dashboard, and history access controls
- `gp`: dashboard, visits, referrals, prescriptions
- `specialist`: specialist notes, lab referrals, medication updates
- `lab`: open lab orders and report uploads
- `pharmacy`: medication queue and dispense actions
- `health_data`: imports, metrics, integrations, and activity overview
- `ai_assistant`: chat, diet plans, exercise plans
- `agentic`: structured AI conversations, plans, and check-ins
- `calendar`: patient calendar events and exercise sync
- `content`: health tips

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui and Radix UI
- Lucide icons
- React Hook Form and Zod
- Recharts
- QR code generation libraries
- Vitest and Testing Library

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.0 async
- PostgreSQL via `asyncpg`
- Alembic migrations
- Pydantic Settings
- JWT authentication
- `python-multipart` for file uploads
- OpenAI Python SDK
- Pytest, Ruff, and MyPy

### AI and data capabilities

- OpenAI-backed health chat and planning flows
- Structured agentic responses for medical, diet, and exercise agents
- Patient-context-aware prompts using profile, medications, lab reports, and health metrics
- Apple Health XML and Google Fit CSV/JSON data import paths

## Frontend Experience

Main frontend areas include:

- Landing and About pages describing the CareSync care model
- Patient signup, login, onboarding, and QR pass delivery
- Patient dashboard with profile, digital health card, and recent history
- Patient AI workspaces for medical, exercise, and diet assistance
- Activity sync page for importing fitness data and manually logging metrics
- GP, specialist, lab, and pharmacy dashboards
- Patient history pages with filtering by labs, medicines, GP visits, and specialist records

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Python 3.12+
- PostgreSQL

### 1. Start the backend

Create `backend/.env` with at least:

```env
APP_NAME=CareSync Backend
ENVIRONMENT=development
API_PREFIX=/api/v1
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/caresync
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Then install and run the API:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
createdb caresync
alembic upgrade head
python -m uvicorn app.main:app --reload
```

Backend URLs:

- API base: `http://127.0.0.1:8000/api/v1`
- Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

To seed local staff accounts:

```sh
cd backend
source .venv/bin/activate
python -m app.tools.seed_staff_users
```

### 2. Start the frontend

Create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then run the frontend:

```sh
cd frontend
npm install
npm run dev
```

Frontend URLs:

- App: `http://127.0.0.1:5173`

## Environment Notes

- `OPENAI_API_KEY` is required for full AI chat and planning behavior
- Wallet issuer credential guidance lives in `backend/credentials/README.md`
- Uploaded files are served from `/media`
- The backend is configured for PostgreSQL in local development

## Typical Product Flow

1. A patient signs up and receives a QR-enabled digital health card.
2. Staff users sign in through the same frontend login flow with provisioned accounts.
3. A GP scans or enters a patient identifier, reviews the dashboard, and records a visit.
4. The GP can refer the patient to a specialist or lab and prescribe medication.
5. Lab staff upload reports, and pharmacy staff dispense medications.
6. The patient reviews history, controls visibility, and uses CareSyncAI tools for guidance.
7. The patient can upload Apple Health or Google Fit exports and use the data inside AI planning flows.

## Repository Structure

```text
caresync/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/              # Router registration and dependencies
│   │   ├── core/             # Settings, security, storage
│   │   ├── db/               # Base and session management
│   │   ├── models/           # Healthcare and agentic models
│   │   ├── modules/          # Domain modules
│   │   └── tools/            # Local scripts such as staff seeding
│   ├── credentials/          # Wallet credential guidance
│   ├── media/                # Uploaded local files
│   └── tests/                # Backend tests
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   └── README.md
└── README.md
```

## Testing And Quality Checks

Backend:

```sh
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest
ruff check .
mypy app
```

Frontend:

```sh
cd frontend
npm run test
npm run lint
npm run build
```

The backend test suite currently covers:

- agentic LLM fallback and plan creation
- activity and health-data import logic
- patient history access behavior

## Additional Notes

- Frontend-specific notes remain in `frontend/README.md`
- Backend-specific setup details remain in `backend/README.md`
- If you want to deploy wallet integrations later, use the guidance in `backend/credentials/README.md`

## License

No license file is currently defined at the repository root.
