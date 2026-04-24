{
  description = "OPM - Product Management Platform";
  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            python311
            python311Packages.pip
            python311Packages.virtualenv
            nodejs_20
            nodePackages.npm
            postgresql_15
            redis
            gcc
            libffi
            openssl
            zlib
            git
            curl
            jq
            pgcli
          ];
          shellHook = ''
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  OPM dev environment"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

            export PROJECT_ROOT=$(pwd)

            # ── PostgreSQL ────────────────────────────────
            export PGDATA="$PROJECT_ROOT/.postgres/data"
            export PGHOST="127.0.0.1"
            export PGPORT="5432"
            export PGUSER="opm"
            export PGPASSWORD="devpassword"
            export PGDATABASE="opm_db"
            export DATABASE_URL="postgresql+psycopg2://opm:devpassword@127.0.0.1:5432/opm_db"
            export ASYNC_DATABASE_URL="postgresql+asyncpg://opm:devpassword@127.0.0.1:5432/opm_db"

            # ── Redis ─────────────────────────────────────
            export REDIS_URL="redis://127.0.0.1:6379/0"
            export CELERY_BROKER_URL="redis://127.0.0.1:6379/0"
            export CELERY_RESULT_BACKEND="redis://127.0.0.1:6379/1"

            # ── App ───────────────────────────────────────
            export APP_ENV="development"
            export SECRET_KEY="dev-secret-key-change-in-production"
            export ALLOWED_ORIGINS="http://localhost:3000"
            export UPLOAD_DIR="$PROJECT_ROOT/backend/uploads"
            export PYTHONPATH="$PROJECT_ROOT/backend:$PYTHONPATH"
            export NEXT_PUBLIC_API_URL="http://localhost:8000"

            # ── Python virtualenv ─────────────────────────
            if [ ! -d "$PROJECT_ROOT/backend/.venv" ]; then
              echo "→ Creating Python virtualenv..."
              python -m venv "$PROJECT_ROOT/backend/.venv"
            fi
            source "$PROJECT_ROOT/backend/.venv/bin/activate"

            if [ ! -f "$PROJECT_ROOT/backend/.venv/.installed" ]; then
              echo "→ Installing Python packages..."
              pip install --quiet --upgrade pip
              pip install --quiet -r "$PROJECT_ROOT/backend/requirements.txt"
              touch "$PROJECT_ROOT/backend/.venv/.installed"
              echo "✓ Python packages installed"
            fi

            # ── PostgreSQL init ───────────────────────────
            if [ ! -d "$PGDATA" ]; then
              echo "→ Initialising PostgreSQL data directory..."
              mkdir -p "$PROJECT_ROOT/.postgres/data"
              initdb \
                --auth=trust \
                --username=opm \
                --pgdata="$PGDATA"
              echo "unix_socket_directories = '$PROJECT_ROOT/.postgres'" >> "$PGDATA/postgresql.conf"
              echo "✓ PostgreSQL data directory ready"
            fi

            mkdir -p "$PROJECT_ROOT/backend/uploads"

            # ── Functions ─────────────────────────────────

            function pg-start() {
              echo "Starting PostgreSQL..."
              pg_ctl -D "$PGDATA" \
                     -l "$PROJECT_ROOT/.postgres/postgres.log" \
                     start
              sleep 2
              echo "Setting up database and user..."
              psql -h 127.0.0.1 -p 5432 -U opm postgres \
                -c "CREATE DATABASE opm_db;" 2>/dev/null || true
              psql -h 127.0.0.1 -p 5432 -U opm postgres \
                -c "CREATE USER opm WITH PASSWORD 'devpassword';" 2>/dev/null || true
              psql -h 127.0.0.1 -p 5432 -U opm postgres \
                -c "GRANT ALL PRIVILEGES ON DATABASE opm_db TO opm;" 2>/dev/null || true
              psql -h 127.0.0.1 -p 5432 -U opm postgres \
                -c "ALTER DATABASE opm_db OWNER TO opm;" 2>/dev/null || true
              echo "✓ PostgreSQL ready on 127.0.0.1:5432"
            }

            function pg-stop() {
              pg_ctl -D "$PGDATA" stop
              echo "✓ PostgreSQL stopped"
            }

            function pg-status() {
              pg_ctl -D "$PGDATA" status
            }

            function pg-logs() {
              tail -f "$PROJECT_ROOT/.postgres/postgres.log"
            }

            function pg-connect() {
              psql -h 127.0.0.1 -p 5432 -U opm opm_db
            }

            function redis-start() {
              echo "Starting Redis..."
              redis-server \
                --daemonize yes \
                --port 6379 \
                --bind 127.0.0.1 \
                --logfile "$PROJECT_ROOT/.redis.log"
              sleep 1
              echo "✓ Redis ready on 127.0.0.1:6379"
            }

            function redis-stop() {
              redis-cli -h 127.0.0.1 -p 6379 shutdown 2>/dev/null \
                && echo "✓ Redis stopped" \
                || echo "Redis was not running"
            }

            function redis-status() {
              redis-cli -h 127.0.0.1 -p 6379 ping
            }

            function redis-logs() {
              tail -f "$PROJECT_ROOT/.redis.log"
            }

            function backend() {
              cd "$PROJECT_ROOT/backend"
              uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
            }

            function worker() {
              cd "$PROJECT_ROOT/backend"
              celery -A app.tasks.celery_app worker \
                --loglevel=info \
                --concurrency=4
            }

            function frontend() {
              cd "$PROJECT_ROOT/frontend"
              npm run dev
            }

            function migrate() {
              cd "$PROJECT_ROOT/backend"
              alembic upgrade head
            }

            function makemigration() {
              cd "$PROJECT_ROOT/backend"
              alembic revision --autogenerate -m "$1"
            }

            function pip-reinstall() {
              rm -f "$PROJECT_ROOT/backend/.venv/.installed"
              pip install -r "$PROJECT_ROOT/backend/requirements.txt"
              touch "$PROJECT_ROOT/backend/.venv/.installed"
              echo "✓ Packages reinstalled"
            }

            function dev-up() {
              pg-start
              redis-start
              echo "━━━ All services up ━━━"
            }

            function dev-down() {
              pg-stop
              redis-stop
              echo "━━━ All services down ━━━"
            }

            function dev-status() {
              pg-status
              redis-status
            }

            function dev-reset() {
              dev-down 2>/dev/null
              rm -rf "$PROJECT_ROOT/.postgres"
              rm -f  "$PROJECT_ROOT/.redis.log"
              rm -rf "$PROJECT_ROOT/backend/.venv"
              echo "✓ Reset complete — exit and run: nix develop"
            }

            echo ""
            echo "  dev-up       → start PostgreSQL + Redis"
            echo "  dev-down     → stop  PostgreSQL + Redis"
            echo "  dev-status   → check both services"
            echo "  backend      → FastAPI on :8000"
            echo "  worker       → Celery worker"
            echo "  frontend     → Next.js on :3000"
            echo "  pg-connect   → psql shell"
            echo "  migrate      → run DB migrations"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
          '';
        };
      }
    );
}
