#!/usr/bin/env bash
# Optional sidecar installation for the existing Ubuntu MathVerse server.
# Does not restart the website, change its database, or submit OCR requests.
# Usage: sudo bash install-document-worker.sh /tmp/mathsea-document-<release>
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
release_input=$(realpath "${1:?extracted worker release directory required}")
[[ "$release_input" == /tmp/mathsea-document-* ]] || { echo 'Use a fresh /tmp/mathsea-document-* release directory'; exit 1; }
cd "$release_input"
sha256sum -c SHA256SUMS
test -f worker.py
test -f /srv/mathsea/backend/.env
backup_dir="/srv/mathsea/backups/document-install-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$backup_dir"
cp -p /srv/mathsea/backend/.env "$backup_dir/backend.env"
if [[ -f /etc/mathsea/document-worker.env ]]; then
  cp -p /etc/mathsea/document-worker.env "$backup_dir/document-worker.env"
fi
if [[ -d /srv/mathsea/document-worker ]]; then
  tar --exclude=.venv --exclude=__pycache__ -C /srv/mathsea -czf "$backup_dir/worker-code.tar.gz" document-worker
fi
if [[ -f /etc/systemd/system/mathsea-document-worker.service ]]; then
  cp -p /etc/systemd/system/mathsea-document-worker.service "$backup_dir/worker.service"
fi
printf 'Configuration backup: %s\n' "$backup_dir"

# Keep the system Python; install only the renderer and its runtime dependencies.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l
apt-get update -qq
apt-get install -y --no-install-recommends libreoffice-writer libreoffice-math fonts-noto-cjk fonts-dejavu-core python3-venv
if ! id mathsea-document >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /srv/mathsea/document-data --no-create-home --shell /usr/sbin/nologin mathsea-document
fi
install -d -o mathsea-document -g mathsea-document -m 0700 /srv/mathsea/document-data
install -d -o root -g root -m 0755 /srv/mathsea/document-worker /srv/mathsea/document-worker/fixtures
for name in worker.py requirements.txt README.md .env.example test_worker.py test_real_word.py smoke_service.py; do
  install -o root -g root -m 0644 "$release_input/$name" "/srv/mathsea/document-worker/$name"
done
install -o root -g root -m 0644 "$release_input/fixtures/expected.md" /srv/mathsea/document-worker/fixtures/expected.md
python3 -m venv /srv/mathsea/document-worker/.venv
/srv/mathsea/document-worker/.venv/bin/python -m pip install --only-binary=:all: -r /srv/mathsea/document-worker/requirements.txt
install -d -m 0755 /etc/mathsea
python3 - <<'PY'
from pathlib import Path
import os, secrets
path = Path('/etc/mathsea/document-worker.env')
if not path.exists():
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write('DOCUMENT_WORKER_TOKEN='+secrets.token_urlsafe(48)+'\n'
                  'DOCUMENT_DATA_DIR=/srv/mathsea/document-data\n'
                  'LIBREOFFICE_BIN=/usr/bin/soffice\n'
                  'DASHSCOPE_API_KEY=\nDASHSCOPE_WORKSPACE_ID=\n')
PY
install -o root -g root -m 0644 "$release_input/mathsea-document-worker.service" /etc/systemd/system/mathsea-document-worker.service
systemctl daemon-reload
systemctl enable --now mathsea-document-worker.service
systemctl restart mathsea-document-worker.service
python3 - <<'PY'
from pathlib import Path
from urllib.request import Request, urlopen
import json, os, time
config = dict(line.split('=',1) for line in Path('/etc/mathsea/document-worker.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
token = config['DOCUMENT_WORKER_TOKEN'].strip().strip('"').strip("'")
headers = {'Authorization': 'Bearer '+token, 'X-Document-Owner': '1'}
for attempt in range(30):
    try:
        with urlopen(Request('http://127.0.0.1:8091/health', headers=headers), timeout=3) as reply:
            result = json.load(reply)
        assert result['ready']
        print('Worker health:', json.dumps(result))
        break
    except Exception:
        if attempt == 29: raise
        time.sleep(1)
# Only these two website settings change; preserve all existing values and permissions.
path = Path('/srv/mathsea/backend/.env')
stat = path.stat()
updates = {'DOCUMENT_WORKER_TOKEN': token, 'DOCUMENT_WORKER_URL': 'http://127.0.0.1:8091'}
lines = [line for line in path.read_text().splitlines() if line.split('=',1)[0] not in updates]
lines.extend(k+'='+v for k,v in updates.items())
temp = path.with_name('.env.document-next')
fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.st_mode & 0o777)
with os.fdopen(fd, 'w') as out: out.write('\n'.join(lines)+'\n')
os.chown(temp, stat.st_uid, stat.st_gid)
temp.replace(path)
print('Website worker connection prepared; website has NOT been restarted.')
PY
printf 'Installed independent worker. Keep backup for rollback: %s\n' "$backup_dir"
