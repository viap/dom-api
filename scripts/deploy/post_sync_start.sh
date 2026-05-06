#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

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

pm2_cutover_domapi
pm2_cutover_dombot_optional
pm2 status

if ! healthcheck_with_retries "${PORT}" "Deploy"; then
  echo "Checking application logs..."
  pm2 logs domApi --lines 20 --nostream
  echo "Checking process status..."
  pm2 status
  exit 1
fi

echo "Deployment completed successfully"
