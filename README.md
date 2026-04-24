# OPM — Product Management Platform

A full-stack product management platform with high-performance bulk CSV import, real-time progress tracking, and a clean dashboard UI.

## Features

- **Bulk CSV Import** — import 500,000+ rows in under 10 seconds using PostgreSQL `COPY`
- **Real-time Progress** — live import progress via Server-Sent Events (SSE)
- **Product Management** — search, sort, paginate, edit, and bulk delete products
- **Dashboard** — inventory stats, import history, and key metrics at a glance
- **Export to CSV** — download your full product catalogue instantly
- **Async Task Queue** — Celery + Redis for non-blocking background imports

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TanStack Query, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic |
| Database | PostgreSQL 15 |
| Task Queue | Celery 5, Redis |
| Dev Environment | Nix flake (reproducible) |

---

## Quick Start (Linux/macOS with Nix — Recommended)

This is the easiest setup path. Nix handles all dependencies automatically.

### 1. Install Nix

\`\`\`bash
sh <(curl -L https://nixos.org/nix/install) --daemon
\`\`\`

Enable flakes by adding this to \`~/.config/nix/nix.conf\`:

\`\`\`
experimental-features = nix-command flakes
\`\`\`

### 2. Clone and enter the dev environment

\`\`\`bash
git clone https://github.com/Shizzzzoo/OPM-platform.git
cd OPM-platform
nix develop
\`\`\`

This automatically installs Python 3.11, Node 20, PostgreSQL 15, Redis, and all dependencies.

### 3. Start services

\`\`\`bash
dev-up       # starts PostgreSQL + Redis
migrate      # runs database migrations
\`\`\`

### 4. Start the app (3 separate terminals, all inside nix develop)

**Terminal 1 — Backend:**
\`\`\`bash
backend      # FastAPI on http://localhost:8000
\`\`\`

**Terminal 2 — Celery Worker:**
\`\`\`bash
worker       # background task processor
\`\`\`

**Terminal 3 — Frontend:**
\`\`\`bash
cd frontend
npm install  # first time only
frontend     # Next.js on http://localhost:3000
\`\`\`

Open http://localhost:3000

---

## Setup Without Nix

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 15+ |
| Redis | 7+ |

---

### macOS

**1. Install dependencies:**

\`\`\`bash
brew install python@3.11 node@20 postgresql@15 redis
brew services start postgresql@15
brew services start redis
\`\`\`

**2. Create database:**

\`\`\`bash
psql postgres -c "CREATE USER opm WITH PASSWORD 'devpassword';"
psql postgres -c "CREATE DATABASE opm_db OWNER opm;"
\`\`\`

**3. Backend setup:**

\`\`\`bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
\`\`\`

**4. Set environment variables:**

\`\`\`bash
export DATABASE_URL="postgresql+psycopg2://opm:devpassword@127.0.0.1:5432/opm_db"
export REDIS_URL="redis://127.0.0.1:6379/0"
export CELERY_BROKER_URL="redis://127.0.0.1:6379/0"
export CELERY_RESULT_BACKEND="redis://127.0.0.1:6379/1"
export ALLOWED_ORIGINS="http://localhost:3000"
export UPLOAD_DIR="./uploads"
export PYTHONPATH=.
\`\`\`

**5. Run migrations:**

\`\`\`bash
alembic upgrade head
\`\`\`

**6. Start backend (Terminal 1):**

\`\`\`bash
uvicorn app.main:app --reload --port 8000
\`\`\`

**7. Start worker (Terminal 2):**

\`\`\`bash
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
\`\`\`

**8. Start frontend (Terminal 3):**

\`\`\`bash
cd ../frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
\`\`\`

---

### Windows

**1. Install dependencies:**

- [Python 3.11](https://www.python.org/downloads/)
- [Node.js 20](https://nodejs.org/)
- [PostgreSQL 15](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
- [Redis for Windows](https://github.com/tporadowski/redis/releases) (or use WSL2)

> **Recommended:** Use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) and follow the macOS instructions above inside WSL2. It is significantly easier.

**2. Create database (in pgAdmin or psql):**

\`\`\`sql
CREATE USER opm WITH PASSWORD 'devpassword';
CREATE DATABASE opm_db OWNER opm;
\`\`\`

**3. Backend setup (PowerShell):**

\`\`\`powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
\`\`\`

**4. Set environment variables (PowerShell):**

\`\`\`powershell
$env:DATABASE_URL="postgresql+psycopg2://opm:devpassword@127.0.0.1:5432/opm_db"
$env:REDIS_URL="redis://127.0.0.1:6379/0"
$env:CELERY_BROKER_URL="redis://127.0.0.1:6379/0"
$env:CELERY_RESULT_BACKEND="redis://127.0.0.1:6379/1"
$env:ALLOWED_ORIGINS="http://localhost:3000"
$env:UPLOAD_DIR=".\uploads"
$env:PYTHONPATH="."
\`\`\`

**5. Run migrations:**

\`\`\`powershell
alembic upgrade head
\`\`\`

**6. Start backend (Terminal 1):**

\`\`\`powershell
uvicorn app.main:app --reload --port 8000
\`\`\`

**7. Start worker (Terminal 2):**

\`\`\`powershell
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 -P solo
\`\`\`

> Note: -P solo is required on Windows as Celery's default prefork pool does not work on Windows.

**8. Start frontend (Terminal 3):**

\`\`\`powershell
cd ..\frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://localhost:8000"
npm run dev
\`\`\`

---

## CSV Format

The import expects a CSV with these columns (case-insensitive):

\`\`\`
sku,name,description,price,quantity
SKU-001,Widget A,A great widget,4.99,50
SKU-002,Widget B,Another widget,9.99,25
\`\`\`

- \`sku\` and \`name\` are required
- \`price\` and \`quantity\` are optional (default to null/0)
- Duplicate SKUs within the file are handled (last row wins)
- Duplicate SKUs already in the database are upserted

## Available Commands (Nix dev shell)

| Command | Description |
|---------|-------------|
| \`dev-up\` | Start PostgreSQL + Redis |
| \`dev-down\` | Stop PostgreSQL + Redis |
| \`dev-status\` | Check service status |
| \`backend\` | Start FastAPI on :8000 |
| \`worker\` | Start Celery worker |
| \`frontend\` | Start Next.js on :3000 |
| \`migrate\` | Run DB migrations |
| \`pg-connect\` | Open psql shell |
| \`pg-logs\` | Tail PostgreSQL logs |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| \`GET\` | \`/api/products\` | List products (paginated, filterable, sortable) |
| \`POST\` | \`/api/products\` | Create a product |
| \`PUT\` | \`/api/products/{id}\` | Update a product |
| \`DELETE\` | \`/api/products/{id}\` | Delete a product |
| \`POST\` | \`/api/products/bulk-delete\` | Bulk delete by IDs |
| \`GET\` | \`/api/products/export/csv\` | Export all products as CSV |
| \`GET\` | \`/api/products/stats/summary\` | Dashboard stats |
| \`POST\` | \`/api/import\` | Upload and start CSV import |
| \`GET\` | \`/api/import/{id}/progress\` | SSE stream for import progress |
| \`GET\` | \`/api/import\` | List recent import jobs |
