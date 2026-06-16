#!/usr/bin/env bash
set -euo pipefail

# Run Drizzle migrations against the production Turso database.
#
# Vercel Sensitive environment variables cannot be read back locally. Instead of
# pulling TURSO_AUTH_TOKEN from Vercel, this script creates a short-lived Turso
# auth token locally and passes it directly to drizzle-kit without writing it to
# disk.

usage() {
  cat <<'USAGE'
Usage: scripts/migrate-prod.sh [options]

Options:
  -y, --yes                 Skip confirmation prompt.
      --database NAME       Turso database name. Defaults to TURSO_PROD_DATABASE_NAME
                            or millionvsbillionvstrillion.
      --token-expiration D  Turso token expiration. Defaults to TURSO_TOKEN_EXPIRATION
                            or 1d. Example: 1d, 7d, never.
  -h, --help                Show this help message.

Examples:
  pnpm db:migrate:prod
  pnpm db:migrate:prod -- --yes
  TURSO_TOKEN_EXPIRATION=7d pnpm db:migrate:prod
USAGE
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

DB_NAME="${TURSO_PROD_DATABASE_NAME:-millionvsbillionvstrillion}"
TOKEN_EXPIRATION="${TURSO_TOKEN_EXPIRATION:-1d}"
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      YES=1
      shift
      ;;
    --database)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Error: --database requires a value." >&2
        exit 1
      fi
      DB_NAME="$2"
      shift 2
      ;;
    --token-expiration)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "Error: --token-expiration requires a value." >&2
        exit 1
      fi
      TOKEN_EXPIRATION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for command_name in turso pnpm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: required command '$command_name' was not found in PATH." >&2
    exit 1
  fi
done

cd "$PROJECT_ROOT"

DATABASE_URL="$(turso db show "$DB_NAME" --url)"
if [[ -z "$DATABASE_URL" || "$DATABASE_URL" != libsql://* ]]; then
  echo "Error: could not resolve a libsql:// URL for Turso database '$DB_NAME'." >&2
  exit 1
fi

DATABASE_HOST="${DATABASE_URL#*://}"
DATABASE_HOST="${DATABASE_HOST%%/*}"

echo "Production migration target:"
echo "  Turso database: $DB_NAME"
echo "  Host: $DATABASE_HOST"
echo "  Token expiration: $TOKEN_EXPIRATION"
echo

if [[ "$YES" -ne 1 ]]; then
  read -r -p "Type 'migrate prod' to apply pending migrations to PRODUCTION: " CONFIRMATION
  if [[ "$CONFIRMATION" != "migrate prod" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Creating temporary Turso auth token..."
TURSO_AUTH_TOKEN_VALUE="$(turso db tokens create "$DB_NAME" --expiration "$TOKEN_EXPIRATION")"
if [[ -z "$TURSO_AUTH_TOKEN_VALUE" ]]; then
  echo "Error: failed to create Turso auth token for '$DB_NAME'." >&2
  exit 1
fi
trap 'unset TURSO_AUTH_TOKEN_VALUE' EXIT

echo "Running Drizzle migrations against $DATABASE_HOST..."
env \
  NODE_ENV=production \
  TURSO_DATABASE_URL="$DATABASE_URL" \
  TURSO_AUTH_TOKEN="$TURSO_AUTH_TOKEN_VALUE" \
  pnpm exec drizzle-kit migrate
