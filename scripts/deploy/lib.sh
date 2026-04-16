#!/usr/bin/env bash
set -euo pipefail

require_env() {
  local var_name
  for var_name in "$@"; do
    if [ -z "${!var_name:-}" ]; then
      echo "${var_name} missing"
      exit 1
    fi
  done
}

ensure_uploads_path() {
  local uploads_root="${1}"
  if [ ! -d "${uploads_root}" ]; then
    echo "Creating REMOTE_UPLOADS_PATH directory..."
    mkdir -p "${uploads_root}"
  fi
  mkdir -p "${uploads_root}/media" "${uploads_root}/thumbnails"
}

ensure_uploads_link() {
  local remote_target="${1}"
  local uploads_root="${2}"
  local context_label="${3}"
  local uploads_link="${remote_target}/uploads"

  if [ -L "${uploads_link}" ]; then
    local current_target expected_target
    current_target="$(readlink -f "${uploads_link}")"
    expected_target="$(readlink -f "${uploads_root}")"
    if [ "${current_target}" != "${expected_target}" ]; then
      echo "Existing uploads symlink points to unexpected location: ${current_target}"
      echo "${context_label}: fix uploads symlink target and re-run."
      exit 1
    fi
    return
  fi

  if [ -e "${uploads_link}" ]; then
    if [ -d "${uploads_link}" ] && [ -z "$(ls -A "${uploads_link}")" ]; then
      rmdir "${uploads_link}"
      ln -s "${uploads_root}" "${uploads_link}"
      return
    fi

    echo "Refusing to replace non-empty ${uploads_link}. Move/clean it manually, then re-run ${context_label}."
    exit 1
  fi

  ln -s "${uploads_root}" "${uploads_link}"
}

verify_uploads_invariant() {
  local remote_target="${1}"
  local uploads_root="${2}"

  test -L "${remote_target}/uploads"
  if [ "$(readlink -f "${remote_target}/uploads")" != "$(readlink -f "${uploads_root}")" ]; then
    echo "Uploads symlink invariant failed"
    exit 1
  fi
}

healthcheck_with_retries() {
  local port="${1}"
  local context_label="${2}"
  local healthcheck_url="http://localhost:${port}/auth/ping"
  local healthcheck_ok=0
  local attempt

  echo "Performing ${context_label} health check with retries..."
  for attempt in $(seq 1 12); do
    if curl -f -s "${healthcheck_url}" | grep -q "pong"; then
      healthcheck_ok=1
      echo "${context_label} health check passed on attempt ${attempt}"
      break
    fi

    echo "${context_label} health check attempt ${attempt}/12 failed, retrying in 5s..."
    sleep 5
  done

  if [ "${healthcheck_ok}" -ne 1 ]; then
    echo "${context_label} health check failed after retries"
    return 1
  fi
}

pm2_cutover_domapi() {
  echo "Cutting over domApi with PM2..."
  if pm2 describe domApi >/dev/null 2>&1; then
    pm2 reload ecosystem.config.js --only domApi --update-env
  else
    pm2 start ecosystem.config.js --only domApi || pm2 start npm --name domApi -- start
  fi
}

pm2_cutover_dombot_optional() {
  echo "Cutting over domBot application (if exists)..."
  if pm2 describe domBot >/dev/null 2>&1; then
    pm2 reload domBot --update-env || echo "Warning: failed to reload domBot - skipping"
  else
    pm2 start domBot || echo "Warning: domBot configuration not found - skipping"
  fi
}
