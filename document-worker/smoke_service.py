"""Private service smoke: synthetic DOCX -> save layout -> PNG zip; zero paid requests.

Run on the server as root so the token never leaves its protected environment file.
The synthetic job is retained under reserved owner 0, not a website user account.
"""
import argparse
import io
import json
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile

from test_real_word import fixture_docx
from worker import new_band


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env-file', default='/etc/mathsea/document-worker.env')
    parser.add_argument('--url', default='http://127.0.0.1:8091')
    parser.add_argument('--preview')
    args = parser.parse_args()
    env = dict(line.split('=', 1) for line in Path(args.env_file).read_text().splitlines()
               if '=' in line and not line.startswith('#'))
    token = env['DOCUMENT_WORKER_TOKEN'].strip().strip('"').strip("'")
    headers = {'Authorization': 'Bearer '+token, 'X-Document-Owner': '0'}

    def api(path, body=None, method='GET', binary=False):
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        with urlopen(Request(args.url+path, data=data, method=method, headers=headers), timeout=40) as response:
            raw = response.read()
            return raw if binary else json.loads(raw)

    health = api('/health')
    assert health['ready']
    job = api('/jobs?name=deployment-smoke.docx', fixture_docx(), 'POST')
    job_path = '/jobs/'+job['id']
    deadline = time.monotonic()+130
    while job['status'] == 'rendering' and time.monotonic() < deadline:
        time.sleep(.3)
        job = api(job_path)
    assert job['status'] == 'ready', job.get('error')
    assert len(job['pages']) == 1
    page = job['pages'][0]
    band = new_band(0, 1000)
    band.update(question='1', type='解答题')
    page.update(edges=[0, 1000], columns=[{'bands': [band], 'suggestions': []}])
    job = api(job_path, {**job, 'edits': {}}, 'PUT')
    restored = api(job_path)
    assert restored['pages'][0]['columns'][0]['bands'][0]['id'] == band['id']
    crop = api(job_path+'/crop/'+band['id'], binary=True)
    assert crop.startswith(b'\x89PNG')
    with zipfile.ZipFile(io.BytesIO(api(job_path+'/crops', binary=True))) as archive:
        assert 'layout.json' in archive.namelist()
        assert archive.read('T1-1-content.png') == crop
    try:
        api(job_path+'/recognize', {'version': job['version'], 'maxCalls': 0, 'batchSize': 1, 'online': False}, 'POST')
        raise AssertionError('Budget zero should have blocked the request')
    except HTTPError as error:
        assert error.code == 400
        assert '上限 0' in error.read().decode()
        error.close()
    assert api(job_path)['calls'] == 0
    if args.preview:
        Path(args.preview).write_bytes(crop)
    print(json.dumps({'health': health, 'job': job['id'], 'pages': 1, 'saved': True, 'cropZip': True,
                      'budgetZeroBlocked': True, 'apiCalls': 0}, ensure_ascii=False))


if __name__ == '__main__':
    main()
