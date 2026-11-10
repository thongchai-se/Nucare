#!/usr/bin/env bash
# ตรวจความพร้อมก่อน Deploy NUCARE บนเซิร์ฟเวอร์คณะ
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.faculty}"
COMPOSE_FILE="docker-compose.faculty.yml"
PROJECT_NAME="nucare"
FAILED=0

ok() { printf 'OK  %s\n' "$1"; }
bad() { printf 'ERR %s\n' "$1"; FAILED=1; }

echo "== NUCARE faculty pre-deploy checks =="

if [[ ! -f "$COMPOSE_FILE" ]]; then
  bad "missing $COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  bad "missing $ENV_FILE (copy from .env.faculty.example)"
else
  ok "found $ENV_FILE"
fi

# shellcheck disable=SC1090
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # อ่านเฉพาะ KEY=VALUE แบบง่าย ไม่ echo ค่า
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

echo "-- compose config --"
if command -v docker >/dev/null 2>&1; then
  if [[ -f "$ENV_FILE" ]]; then
    if docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null; then
      ok "docker compose config is valid"
    else
      bad "docker compose config failed"
    fi
  else
    bad "skip compose config (no env file)"
  fi
else
  bad "docker not found on PATH"
fi

echo "-- secret files --"
SECRET_VARS=(
  NUCARE_POSTGRES_PASSWORD_SECRET_FILE
  NUCARE_DATABASE_URL_SECRET_FILE
  NUCARE_JWT_ACCESS_SECRET_FILE
  NUCARE_JWT_REFRESH_SECRET_FILE
  NUCARE_AI_API_KEY_SECRET_FILE
)

for var_name in "${SECRET_VARS[@]}"; do
  file_path="${!var_name:-}"
  if [[ -z "$file_path" ]]; then
    bad "$var_name is not set in $ENV_FILE"
    continue
  fi
  if [[ ! -f "$file_path" ]]; then
    bad "$var_name file missing: $file_path"
    continue
  fi
  if [[ ! -s "$file_path" ]]; then
    bad "$var_name file is empty: $file_path"
    continue
  fi
  # ตรวจว่ามีเนื้อหาที่ไม่ใช่แต่ whitespace
  if ! grep -Eq '[[:graph:]]' "$file_path"; then
    bad "$var_name file has no printable content: $file_path"
    continue
  fi
  ok "$var_name exists and is non-empty"
done

echo "-- gitignore --"
if [[ -f .gitignore ]]; then
  if grep -Eq '^\.env\.faculty$|^\.env\.\*$' .gitignore || grep -Eq '^\.env\.\*' .gitignore; then
    ok ".env.faculty covered by gitignore"
  else
    bad ".env.faculty does not appear ignored"
  fi
  if grep -Eq '^secrets/|^secrets/\*' .gitignore; then
    ok "secrets/ covered by gitignore"
  else
    bad "secrets/ does not appear ignored"
  fi
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git check-ignore -q .env.faculty 2>/dev/null || [[ ! -f .env.faculty ]]; then
      ok "git check-ignore accepts .env.faculty pattern"
    else
      bad ".env.faculty is tracked/not ignored"
    fi
    if git check-ignore -q secrets/faculty/postgres_password.txt 2>/dev/null; then
      ok "git ignores secrets/faculty/*"
    else
      bad "secrets/faculty files are not ignored"
    fi
  fi
else
  bad "missing .gitignore"
fi

echo "-- build readiness --"
if [[ ! -f server/Dockerfile ]]; then
  bad "missing server/Dockerfile"
else
  ok "server/Dockerfile present"
fi
if [[ ! -f client/Dockerfile ]]; then
  bad "missing client/Dockerfile"
else
  ok "client/Dockerfile present"
fi
if [[ ! -d server/prisma/migrations ]]; then
  bad "missing server/prisma/migrations"
else
  ok "prisma migrations present"
fi

if [[ "${CHECK_FACULTY_BUILD:-0}" == "1" ]] && command -v docker >/dev/null 2>&1 && [[ -f "$ENV_FILE" ]]; then
  echo "-- optional image build (CHECK_FACULTY_BUILD=1) --"
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build server
  docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build client
  ok "server and client images built"
else
  ok "skip image build (set CHECK_FACULTY_BUILD=1 to enable)"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "== FAILED: fix errors above before deploy =="
  exit 1
fi

echo "== PASSED: faculty deploy checks =="
