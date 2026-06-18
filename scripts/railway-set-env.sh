#!/usr/bin/env bash
# Push the env vars this app needs from your local .env.local into the linked
# Railway service. Run AFTER `railway login` and `railway link`.
#
#   bash scripts/railway-set-env.sh
#
# Secrets are read from .env.local at runtime and never committed. NEXT_PUBLIC_*
# vars are inlined at BUILD time, so they must exist before the first build —
# this script sets them, then trigger a fresh deploy.
set -euo pipefail

ENV_FILE="${1:-.env.local}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }
command -v railway >/dev/null || { echo "railway CLI not found: npm i -g @railway/cli"; exit 1; }

# Only these keys are actually used by the app (see CLAUDE.md / migration plan).
KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  KIMI_API_KEY
  OREKA_BASE_URL
  OREKA_USER
  OREKA_PASSWORD
  OREKA_HOPEFUL_USER
  OREKA_HOPEFUL_PASSWORD
  SUPERVISOR_INVITE_CODE
)

args=()
for key in "${KEYS[@]}"; do
  # Grab the first matching line, strip the KEY= prefix, keep the raw value.
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)
  [ -z "$line" ] && { echo "skip (not in $ENV_FILE): $key"; continue; }
  val=${line#*=}
  # Strip a trailing CR and one layer of surrounding quotes — dotenv does this at
  # runtime, so the raw line value must be unwrapped before sending to Railway,
  # else passwords/keys are stored WITH the quotes and auth fails (HTTP 401).
  val=${val%$'\r'}
  case "$val" in \"*\") val=${val#\"}; val=${val%\"};; \'*\') val=${val#\'}; val=${val%\'};; esac
  args+=(--set "${key}=${val}")
  echo "queued: $key"
done

[ ${#args[@]} -eq 0 ] && { echo "nothing to set"; exit 1; }
railway variables "${args[@]}"
echo "Done. Now: railway up   (or push to the connected branch to deploy)"
