#!/usr/bin/env bash
set -Eeuo pipefail
cd /tmp

systemctl is-active --quiet mathsea-backend.service
systemctl is-active --quiet mathsea-importer.service
systemctl is-active --quiet nginx
curl -fsS http://127.0.0.1:8000/actuator/health >/dev/null
curl -fsS http://127.0.0.1:8001/api/auth/session >/dev/null
grep -q '__version__ = "0.6.0"' /srv/mathsea-importer/current/backend/app/__init__.py
sudo -u postgres psql -d mathsea -Atc \
  "SELECT version || ':' || success FROM flyway_schema_history WHERE version='18'" \
  | grep -qx '18:true'

main_secret=$(sudo sed -n 's/^IMPORTER_INTEGRATION_SECRET=//p' /srv/mathsea/backend/.env)
importer_secret=$(sudo sed -n 's/^IMPORTER_INTEGRATION_SECRET=//p' /srv/mathsea-importer/shared/.env)
[[ ${#main_secret} -ge 32 ]]
[[ "$main_secret" == "$importer_secret" ]]

job_dir=$(sudo find /srv/mathsea-importer/shared/data -mindepth 2 -maxdepth 2 -name source.pdf \
  -printf '%h\n' | head -n 1)
job=$(basename "$job_dir")
[[ -n "$job" ]]
invalid=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer invalid' \
  "http://127.0.0.1:8001/api/integration/jobs/$job/source")
valid=$(curl -sS -o /dev/null -w '%{http_code}:%{content_type}' \
  -H "Authorization: Bearer $importer_secret" \
  "http://127.0.0.1:8001/api/integration/jobs/$job/source")
[[ "$invalid" == '401' ]]
[[ "$valid" == '200:application/pdf' ]]

curl -fsS --resolve mathverse.com.cn:443:127.0.0.1 \
  https://mathverse.com.cn/api/v1/health >/dev/null
curl -fsS --resolve import.mathverse.com.cn:443:127.0.0.1 \
  https://import.mathverse.com.cn/api/auth/session >/dev/null
grep -R -q 'source-file' /var/www/mathsea-current/assets
grep -R -q '创建草稿并统一审核' /srv/mathsea-importer/current/frontend/dist/assets

echo 'services=active migration=18 integration-secret=matched invalid=401 valid=200:application/pdf public=healthy assets=current'
