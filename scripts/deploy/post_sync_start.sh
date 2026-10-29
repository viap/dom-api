#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

use_node

require_env \
  PORT \
  WEBSOCKET_PORT \
  CORS_ORIGINS \
  PUBLIC_WEB_URL \
  TELEGRAM_BOT_USERNAME \
  APPLICATION_MESSAGING_ENABLED \
  JWT_SECRET \
  BOT_CLIENT_NAME \
  BOT_CLIENT_PASSWORD \
  WEB_CLIENT_NAME \
  WEB_CLIENT_PASSWORD \
  MONGO_URL \
  MONGO_DBNAME \
  MONGO_INITDB_ROOT_USERNAME \
  MONGO_INITDB_ROOT_PASSWORD \
  REMOTE_TARGET \
  REMOTE_UPLOADS_PATH

cd "${REMOTE_TARGET}"
ensure_uploads_path "${REMOTE_UPLOADS_PATH}"
ensure_uploads_link "${REMOTE_TARGET}" "${REMOTE_UPLOADS_PATH}" "deploy"
verify_uploads_invariant "${REMOTE_TARGET}" "${REMOTE_UPLOADS_PATH}"

echo "Creating logs directory..."
mkdir -p logs

echo "Installing dependencies..."
npm ci --omit=dev

echo "Validating CORS_ORIGINS format..."
validate_cors_origins "${CORS_ORIGINS}"
echo "Configured CORS_ORIGINS: ${CORS_ORIGINS}"

if [[ ! "${TELEGRAM_BOT_USERNAME}" =~ ^[A-Za-z0-9_]{5,32}$ ]]; then
  echo "TELEGRAM_BOT_USERNAME must be a valid Telegram username without @" >&2
  exit 1
fi

if [[ "${APPLICATION_MESSAGING_ENABLED}" != "true" && "${APPLICATION_MESSAGING_ENABLED}" != "false" ]]; then
  echo "APPLICATION_MESSAGING_ENABLED must be explicitly set to true or false" >&2
  exit 1
fi

pm2_cutover_domapi
pm2 status

if ! healthcheck_with_retries "${PORT}" "Deploy"; then
  echo "Checking application logs..."
  pm2 logs domApi --lines 20 --nostream
  echo "Checking process status..."
  pm2 status
  exit 1
fi

if ! cors_smoke_check_all "${PORT}" "${CORS_ORIGINS}"; then
  echo "CORS check failed. Diagnosing mismatch..."
  echo "  Shell CORS_ORIGINS : ${CORS_ORIGINS}"
  echo "  config/.env CORS_ORIGINS: $(grep '^CORS_ORIGINS=' config/.env | cut -d= -f2- || echo '(not found)')"
  echo "Checking application logs..."
  pm2 logs domApi --lines 20 --nostream
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

pm2_save
echo "Deployment completed successfully"
