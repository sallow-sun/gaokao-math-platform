"""Package built artifacts only; no server access or runtime data."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import io
import tarfile

root = Path(__file__).resolve().parents[1]
jar = root / 'backend/target/mathsea-backend-0.1.0-SNAPSHOT.jar'
frontend = root / 'frontend/dist'
if not jar.is_file() or not (frontend / 'index.html').is_file():
    raise SystemExit('Build backend and frontend first; see docs/DEVELOPMENT.md')
files = [(jar, 'app.jar')] + [(p, 'frontend/' + p.relative_to(frontend).as_posix())
                              for p in sorted(frontend.rglob('*')) if p.is_file()]
output = root / 'release'
output.mkdir(exist_ok=True)
archive = output / ('mathsea-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.tar.gz')
checksums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {name}\n'
                    for p, name in files).encode('utf-8')
with tarfile.open(archive, 'x:gz') as tar:
    for p, name in files:
        tar.add(p, arcname=name)
    info = tarfile.TarInfo('SHA256SUMS')
    info.size = len(checksums)
    tar.addfile(info, io.BytesIO(checksums))
print(archive)
