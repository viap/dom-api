#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

echo "Loading environment from ${APP_ROOT}/config/.env..."
set -a
# shellcheck source=../../config/.env
source "${APP_ROOT}/config/.env"
set +a

require_env \
  PORT \
  WEBSOCKET_PORT \
  CORS_ORIGINS \
  JWT_SECRET \
  BOT_CLIENT_NAME \
  BOT_CLIENT_PASSWORD \
  WEB_CLIENT_NAME \
  WEB_CLIENT_PASSWORD \
  MONGO_URL \
  MONGO_DBNAME \
  MONGO_INITDB_ROOT_USERNAME \
  MONGO_INITDB_ROOT_PASSWORD

cd "${APP_ROOT}"

echo "Validating CORS_ORIGINS format..."
validate_cors_origins "${CORS_ORIGINS}"
echo "Configured CORS_ORIGINS: ${CORS_ORIGINS}"

echo "Restarting domApi with updated environment..."
pm2 restart domApi --update-env
pm2_cutover_dombot_optional
pm2 status

if ! healthcheck_with_retries "${PORT}" "Manual restart"; then
  echo "Checking application logs..."
  pm2 logs domApi --lines 20 --nostream
  echo "Checking process status..."
  pm2 status
  exit 1
fi

if ! cors_smoke_check_all "${PORT}" "${CORS_ORIGINS}"; then
  echo "Checking application logs..."
  pm2 logs domApi --lines 20 --nostream
  echo "Inspecting effective runtime env for domApi..."
  pm2 env domApi | grep -E '^(CORS_ORIGINS|PORT)=' || true
  echo "Checking process status..."
  pm2 status
  exit 1
fi

if ! auth_reason_smoke_check "${PORT}"; then
  echo "Auth branch smoke check failed."
  echo "Checking application logs..."
  pm2 logs domApi --lines 40 --nostream
  exit 1
fi

echo "Manual restart completed successfully"
