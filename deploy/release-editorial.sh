#!/usr/bin/env bash
# Run as root after extracting the release to a new directory.
# Usage: sudo bash release-editorial.sh /tmp/mathsea-editorial-<timestamp>
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
release_input=$(realpath "${1:?release directory required}")
test -f "$release_input/app.jar"
test -f "$release_input/frontend/index.html"
cd "$release_input"
sha256sum -c SHA256SUMS

app_root=/srv/mathsea/backend
test -f "$app_root/app.jar"
test -f "$app_root/start.sh"
test -f "$app_root/.env"
systemctl is-active --quiet postgresql
systemctl is-active --quiet redis-server
nginx -t

release_id="editorial-$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/srv/mathsea/backups/$release_id"
frontend_release="/var/www/mathsea-releases/$release_id"
previous_frontend=$(readlink -f /var/www/mathsea-current)
test -f "$previous_frontend/index.html"
install -d -m 0700 "$backup_dir"
cp -p "$app_root/app.jar" "$backup_dir/app.jar"
cp -p "$app_root/.env" "$backup_dir/backend.env"
cp -p "$app_root/start.sh" "$backup_dir/start.sh"
systemctl cat mathsea-backend.service > "$backup_dir/mathsea-backend.service.txt"
printf '%s\n' "$previous_frontend" > "$backup_dir/previous-frontend.txt"

rollback() {
  failure_code=$?
  trap - ERR
  echo 'Release failed. Restoring the prior application and frontend.' >&2
  cp -p "$backup_dir/app.jar" "$app_root/app.jar.rollback"
  mv -f "$app_root/app.jar.rollback" "$app_root/app.jar"
  ln -sfn "$previous_frontend" /var/www/.mathsea-rollback
  mv -Tf /var/www/.mathsea-rollback /var/www/mathsea-current
  systemctl restart mathsea-backend.service || true
  echo "Backup: $backup_dir; additive database tables are retained." >&2
  exit "$failure_code"
}
trap rollback ERR

# Stop writes briefly so the database and upload backup describe the same state.
systemctl stop mathsea-backend.service
sudo -u postgres pg_dump -Fc mathsea > "$backup_dir/mathsea.dump"
sudo -u postgres psql -d mathsea -c "COPY (SELECT id,problem_number,title FROM problems ORDER BY id) TO STDOUT WITH CSV HEADER" > "$backup_dir/question-numbers-before.csv"
if [[ -d "$app_root/uploads" ]]; then
  tar -C "$app_root" -czf "$backup_dir/uploads.tar.gz" uploads
fi
sha256sum "$backup_dir/app.jar" "$backup_dir/mathsea.dump" > "$backup_dir/SHA256SUMS"

install -o backend-deploy -g backend-deploy -m 0644 "$release_input/app.jar" "$app_root/app.jar.next"
mv -f "$app_root/app.jar.next" "$app_root/app.jar"
install -d -m 0755 "$frontend_release"
cp -a "$release_input/frontend/." "$frontend_release/"
chown -R root:root "$frontend_release"
find "$frontend_release" -type d -exec chmod 755 {} +
find "$frontend_release" -type f -exec chmod 644 {} +
systemctl start mathsea-backend.service

healthy=false
for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/actuator/health > "$backup_dir/health.json"; then
    healthy=true
    break
  fi
  sleep 1
done
[[ $healthy == true ]]
sudo -u postgres psql -d mathsea -Atc "SELECT version || ':' || success FROM flyway_schema_history WHERE version='12'" | grep -qx '12:true'
sudo -u postgres psql -d mathsea -Atc "SELECT count(*) FROM problems WHERE problem_number !~ '^[GETN][CMFS][0-9]{6}$'" | grep -qx '0'
sudo -u postgres psql -d mathsea -c "COPY (SELECT p.id,p.problem_number,a.old_number,p.title FROM problems p LEFT JOIN problem_number_aliases a ON a.problem_id=p.id ORDER BY p.id,a.old_number) TO STDOUT WITH CSV HEADER" > "$backup_dir/question-numbers-after.csv"

ln -sfn "$frontend_release" /var/www/.mathsea-editorial-next
mv -Tf /var/www/.mathsea-editorial-next /var/www/mathsea-current
nginx -t
systemctl reload nginx
curl -fsS --resolve mathverse.com.cn:443:127.0.0.1 https://mathverse.com.cn/ > "$backup_dir/frontend-check.html"
curl -fsS --resolve mathverse.com.cn:443:127.0.0.1 https://mathverse.com.cn/api/v1/health
trap - ERR
printf '\nRelease: %s\nBackup: %s\n' "$frontend_release" "$backup_dir"
