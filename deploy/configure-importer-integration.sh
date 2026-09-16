#!/usr/bin/env bash
# Configure the private MathSea -> importer PDF proxy without printing the shared secret.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }

main_env=/srv/mathsea/backend/.env
importer_env=/srv/mathsea-importer/shared/.env
test -f "$main_env"
test -f "$importer_env"

upsert_env() {
  local file="$1" key="$2" value="$3" output
  output=$(mktemp "$(dirname "$file")/.env.XXXXXX")
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$file" > "$output"
  chown --reference="$file" "$output"
  chmod --reference="$file" "$output"
  mv -f "$output" "$file"
}

secret=$(sed -n 's/^IMPORTER_INTEGRATION_SECRET=//p' "$importer_env" | tail -n 1)
if [[ ${#secret} -lt 32 ]]; then
  secret=$(openssl rand -hex 32)
fi

upsert_env "$importer_env" IMPORTER_INTEGRATION_SECRET "$secret"
upsert_env "$main_env" IMPORTER_INTEGRATION_SECRET "$secret"
upsert_env "$main_env" IMPORTER_BASE_URL http://127.0.0.1:8001
echo 'Importer integration settings are configured.'
