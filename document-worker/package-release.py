"""Package this optional service only; no credentials, user documents or website files."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import io
import tarfile

root = Path(__file__).resolve().parent
names = ['worker.py', 'requirements.txt', 'README.md', '.env.example',
         'mathsea-document-worker.service', 'test_worker.py', 'test_real_word.py', 'smoke_service.py', 'fixtures/expected.md']
output = root/'release'
output.mkdir(exist_ok=True)
archive = output/('mathsea-document-worker-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gz')
checksums = ''.join(hashlib.sha256((root/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in names).encode()
with tarfile.open(archive, 'x:gz') as tar:
    for name in names:
        tar.add(root/name, arcname=name)
    info = tarfile.TarInfo('SHA256SUMS')
    info.size = len(checksums)
    tar.addfile(info, io.BytesIO(checksums))
print(archive)
