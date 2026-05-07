#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

# Initialize NVM so the correct Node version is active in this SSH session.
# fifsky/ssh-action does not source ~/.bashrc or ~/.nvm/nvm.sh, so without this
# `command -v node` resolves to the system node (v18) instead of NVM node (v20).
if [ -s "/root/.nvm/nvm.sh" ]; then
  export NVM_DIR="/root/.nvm"
  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh" --no-use
  nvm use 20 --silent || true
fi

export NODE_BIN_DIR="$(dirname "$(command -v node)")"
echo "Using Node.js: $(node --version) at ${NODE_BIN_DIR}"

NODE_MAJOR="$(node --version | sed 's/v\([0-9]*\).*/\1/')"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "ERROR: Node.js v20+ required. Got: $(node --version)"
  exit 1
fi

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

echo "Validating CORS_ORIGINS format..."
validate_cors_origins "${CORS_ORIGINS}"
echo "Configured CORS_ORIGINS: ${CORS_ORIGINS}"

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

echo "Deployment completed successfully"
