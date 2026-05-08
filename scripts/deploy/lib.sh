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

trim() {
  local value="${1}"
  # shellcheck disable=SC2001
  echo "${value}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

is_valid_origin() {
  local origin="${1}"
  [[ "${origin}" =~ ^https?://[^/]+$ ]]
}

first_cors_origin() {
  local raw_origins="${1}"
  IFS=',' read -r -a origins <<< "${raw_origins}"
  local candidate
  for candidate in "${origins[@]}"; do
    candidate="$(trim "${candidate}")"
    [ -n "${candidate}" ] || continue
    if ! is_valid_origin "${candidate}"; then
      echo "Invalid CORS_ORIGINS entry: '${candidate}'. Expected format: scheme://host:port (no path/trailing slash)." >&2
      return 1
    fi
    echo "${candidate}"
    return 0
  done

  echo "CORS_ORIGINS has no non-empty entries" >&2
  return 1
}

validate_cors_origins() {
  local raw_origins="${1}"
  IFS=',' read -r -a origins <<< "${raw_origins}"
  local candidate
  for candidate in "${origins[@]}"; do
    candidate="$(trim "${candidate}")"
    [ -n "${candidate}" ] || continue
    if ! is_valid_origin "${candidate}"; then
      echo "Invalid CORS_ORIGINS entry: '${candidate}'. Expected format: scheme://host:port (no path/trailing slash)." >&2
      return 1
    fi
  done
}

cors_header_present() {
  local headers="${1}"
  local expected_origin="${2}"
  local clean_headers
  clean_headers="$(printf '%s' "${headers}" | tr -d '\r')"
  if echo "${clean_headers}" | grep -iq "^Access-Control-Allow-Origin: ${expected_origin}$"; then
    return 0
  fi
  return 1
}

cors_smoke_check() {
  local port="${1}"
  local expected_origin="${2}"
  local options_headers
  local post_headers
  local endpoint="http://localhost:${port}/auth/login/user"

  echo "Running CORS smoke check for origin: ${expected_origin}"

  options_headers="$(curl -sS -D - -o /dev/null -X OPTIONS "${endpoint}" \
    -H "Origin: ${expected_origin}" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type,authorization")"

  if ! cors_header_present "${options_headers}" "${expected_origin}"; then
    echo "CORS preflight check failed: missing Access-Control-Allow-Origin for ${expected_origin}" >&2
    echo "${options_headers}" >&2
    return 1
  fi

  post_headers="$(curl -sS -D - -o /dev/null -X POST "${endpoint}" \
    -H "Origin: ${expected_origin}" \
    -H "Content-Type: application/json" \
    --data '{"apiClient":{"name":"__cors_probe__","password":"__cors_probe__"},"user":{"login":"__cors_probe__","password":"__cors_probe__"}}')"

  if ! cors_header_present "${post_headers}" "${expected_origin}"; then
    echo "CORS POST check failed: missing Access-Control-Allow-Origin for ${expected_origin}" >&2
    echo "${post_headers}" >&2
    return 1
  fi

  echo "CORS smoke check passed"
}

cors_smoke_check_all() {
  local port="${1}"
  local raw_origins="${2}"
  IFS=',' read -r -a origins <<< "${raw_origins}"
  local candidate
  local checked=0

  for candidate in "${origins[@]}"; do
    candidate="$(trim "${candidate}")"
    [ -n "${candidate}" ] || continue
    checked=1
    if ! cors_smoke_check "${port}" "${candidate}"; then
      return 1
    fi
  done

  if [ "${checked}" -ne 1 ]; then
    echo "No valid CORS origins found for smoke check" >&2
    return 1
  fi
}

assert_auth_reason_in_logs() {
  local request_id="${1}"
  local expected_reason="${2}"
  local logs
  logs="$(pm2 logs domApi --lines 400 --nostream | tr -d '\r')"

  if echo "${logs}" | grep -F "\"requestId\":\"${request_id}\"" | grep -F "\"reason\":\"${expected_reason}\"" >/dev/null; then
    return 0
  fi

  echo "Expected auth reason '${expected_reason}' for requestId '${request_id}' not found in domApi logs" >&2
  return 1
}

auth_reason_smoke_check() {
  local port="${1}"
  local endpoint="http://localhost:${port}/auth/login/user"
  local probe_login="__deploy_probe__"
  local probe_password="__deploy_probe__"
  local valid_client_request_id
  local invalid_client_request_id
  local status_code

  valid_client_request_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  invalid_client_request_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"

  status_code="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${endpoint}" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: ${valid_client_request_id}" \
    --data "{\"apiClient\":{\"name\":\"${WEB_CLIENT_NAME}\",\"password\":\"${WEB_CLIENT_PASSWORD}\"},\"user\":{\"login\":\"${probe_login}\",\"password\":\"${probe_password}\"}}")"

  if [ "${status_code}" != "401" ]; then
    echo "Auth smoke check failed for valid apiClient + bad user probe. Expected 401, got ${status_code}" >&2
    return 1
  fi

  status_code="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${endpoint}" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: ${invalid_client_request_id}" \
    --data "{\"apiClient\":{\"name\":\"${WEB_CLIENT_NAME}\",\"password\":\"__invalid_api_client_password__\"},\"user\":{\"login\":\"${probe_login}\",\"password\":\"${probe_password}\"}}")"

  if [ "${status_code}" != "401" ]; then
    echo "Auth smoke check failed for invalid apiClient probe. Expected 401, got ${status_code}" >&2
    return 1
  fi

  # Give logger a short time to flush structured auth failure records.
  sleep 1

  assert_auth_reason_in_logs "${valid_client_request_id}" "invalid_user_credentials"
  assert_auth_reason_in_logs "${invalid_client_request_id}" "invalid_api_client"
}

pm2_cutover_domapi() {
  echo "Cutting over domApi with PM2..."
  if pm2 describe domApi >/dev/null 2>&1; then
    pm2 delete domApi
    pm2 start ecosystem.config.js --only domApi
  else
    pm2 start ecosystem.config.js --only domApi || pm2 start npm --name domApi -- start
  fi
}

pm2_cutover_dombot_optional() {
  echo "Cutting over domBot application (if exists)..."
  if pm2 describe domBot >/dev/null 2>&1; then
    pm2 restart domBot --update-env
  else
    echo "Warning: failed to reload domBot - skipping"
  fi 
}
