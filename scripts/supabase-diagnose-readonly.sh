#!/bin/sh
set -eu

PROJECT_REF=${SUPABASE_PROJECT_REF:-ueyamyqbsimmpourinmz}

case "$PROJECT_REF" in
  ''|*[!a-z0-9]*)
    echo "Référence de projet invalide." >&2
    exit 2
    ;;
esac

if [ "${#PROJECT_REF}" -ne 20 ]; then
  echo "La référence Supabase doit contenir 20 caractères." >&2
  exit 2
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI introuvable. Installez-la depuis la documentation officielle." >&2
  exit 127
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SQL_FILE="$SCRIPT_DIR/../supabase-diagnostics/read-only-check.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "Fichier de diagnostic introuvable : $SQL_FILE" >&2
  exit 2
fi

echo "Vérification en lecture seule du projet $PROJECT_REF…"
exec supabase db query \
  --remote="$PROJECT_REF" \
  --read-only \
  --file "$SQL_FILE" \
  --output table
