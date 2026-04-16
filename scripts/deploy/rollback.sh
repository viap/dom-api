#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_env PORT REMOTE_TARGET REMOTE_UPLOADS_PATH

echo "Rolling back to previous deployment..."
cd "$(dirname "${REMOTE_TARGET}")"

LATEST_BACKUP="$(ls -dt "${REMOTE_TARGET}"_backup_* 2>/dev/null | head -n 1)"
if [ -z "${LATEST_BACKUP}" ]; then
  echo "No backup found for rollback"
  exit 1
fi

echo "Stopping current applications..."
pm2 stop domApi domBot || true
pm2 delete domApi || true

echo "Restoring from backup: ${LATEST_BACKUP}"
rm -rf "${REMOTE_TARGET}"
cp -r "${LATEST_BACKUP}" "${REMOTE_TARGET}"

cd "${REMOTE_TARGET}"
ensure_uploads_path "${REMOTE_UPLOADS_PATH}"
ensure_uploads_link "${REMOTE_TARGET}" "${REMOTE_UPLOADS_PATH}" "rollback"
verify_uploads_invariant "${REMOTE_TARGET}" "${REMOTE_UPLOADS_PATH}"

echo "Restarting applications..."
npm ci --omit=dev
pm2_cutover_domapi
pm2_cutover_dombot_optional

if ! healthcheck_with_retries "${PORT}" "Rollback"; then
  pm2 logs domApi --lines 20 --nostream
  pm2 status
  exit 1
fi

pm2 status
echo "Rollback completed successfully"
