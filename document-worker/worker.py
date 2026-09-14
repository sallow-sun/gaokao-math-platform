"""Isolated, private document worker. No website database or publishing access."""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import hmac
import io
import json
import math
import multiprocessing
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import numpy as np
import pymupdf

VERSION = 'split-ocr-v1'
TYPES = ['单选题', '多选题', '填空题', '解答题', '未知']
SECTIONS = ['content', 'answer', 'solution']
MAX_UPLOAD = 10 * 1024 * 1024
MAX_PAGES = 80
MODEL = 'qwen3.8-flash'


class Problem(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def write_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def runs(mask):
    edges = np.diff(np.r_[False, mask, False].astype(int))
    return list(zip(np.where(edges == 1)[0], np.where(edges == -1)[0]))


def suggestions(path):
    pix = pymupdf.Pixmap(str(path))
    while pix.width > 1200:
        pix.shrink(1)
    pixels = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    ink = pixels[:, :, :3].mean(axis=2) < 215
    height, width = ink.shape
    density = ink[int(height * .05):int(height * .95)].mean(axis=0)
    gaps = [(a, b) for a, b in runs(density < .004)
            if a > width * .15 and b < width * .85 and b-a > width * .006]
    # Wide gutters are suggestions only. Never infer question boundaries from whitespace alone.
    gaps = sorted(gaps, key=lambda g: g[1]-g[0], reverse=True)[:3]
    centers = []
    for a, b in gaps:
        center = (a+b)/2/width*1000
        if all(abs(center-x) > 180 for x in centers):
            centers.append(center)
    edges = [0] + sorted(round(x, 2) for x in centers) + [1000]
    columns = []
    for left, right in zip(edges, edges[1:]):
        region = ink[:, max(0, int(left/1000*width)):max(1, int(right/1000*width))]
        blanks = runs(region.mean(axis=1) < .004)
        horizontal = [round((a+b)/2/height*1000, 2) for a, b in blanks
                      if a > height*.02 and b < height*.98 and b-a > height*.005][:80]
        columns.append({'bands': [new_band(0, 1000)], 'suggestions': horizontal})
    return edges, columns


def new_band(top, bottom):
    return {'id': uuid.uuid4().hex, 'top': top, 'bottom': bottom,
            'question': '', 'section': 'content', 'type': '未知', 'skip': False}


def render_pages(source_name, count):
    """Executed in a dedicated single-threaded process, never an HTTP/job thread."""
    source = Path(source_name)
    with pymupdf.open(source) as doc:
        if doc.needs_pass:
            raise ValueError('PDF 有密码，请上传解密后的文件')
        if not doc.page_count or doc.page_count + count > MAX_PAGES:
            raise ValueError('每个任务最多 80 页')
        pages = []
        for page in doc:
            page_id = uuid.uuid4().hex
            dest = source.parent / (page_id + '.png')
            if source.suffix != '.pdf':
                pix = pymupdf.Pixmap(str(source))
                if pix.colorspace is None or pix.colorspace.n != 3:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                if pix.alpha:
                    pix = pymupdf.Pixmap(pix, 0)
            else:
                if page.rect.width * page.rect.height * (180/72)**2 > 25_000_000:
                    raise ValueError('页面尺寸过大，请先缩小页面')
                pix = page.get_pixmap(dpi=180, alpha=False)
            if pix.width * pix.height > 25_000_000:
                raise ValueError('图片超过 2500 万像素')
            pix.save(dest)
            edges, columns = suggestions(dest)
            pages.append({'id': page_id, 'image': dest.name, 'width': pix.width,
                          'height': pix.height, 'edges': edges, 'columns': columns})
    return pages


def crop_image(path, region, bbox):
    original = pymupdf.Pixmap(path)
    left, top, right, bottom = region
    if bbox:
        a, b, c, d = bbox
        left, top, right, bottom = (left+(right-left)*a/1000, top+(bottom-top)*b/1000,
                                   left+(right-left)*c/1000, top+(bottom-top)*d/1000)
    rect = pymupdf.IRect(math.floor(left*original.width/1000), math.floor(top*original.height/1000),
                        math.ceil(right*original.width/1000), math.ceil(bottom*original.height/1000))
    target = pymupdf.Pixmap(original.colorspace, rect, False)
    target.copy(original, rect)
    return target.tobytes('png')


def validate_layout(pages):
    seen = set()
    for page in pages:
        edges = page.get('edges', [])
        if len(edges) < 2 or len(edges) > 9 or edges[0] != 0 or edges[-1] != 1000:
            raise Problem('栏边界必须覆盖 0 到 1000，最多八栏')
        if any(not isinstance(x, (float, int)) or not math.isfinite(x) for x in edges):
            raise Problem('无效的栏坐标')
        if any(b-a < 20 for a, b in zip(edges, edges[1:])):
            raise Problem('栏宽过小或边界交叉')
        if len(page.get('columns', [])) != len(edges)-1:
            raise Problem('栏位数量与边界不一致')
        for column in page['columns']:
            previous = 0
            if not 1 <= len(column.get('bands', [])) <= 100:
                raise Problem('每栏需要 1 到 100 个区域')
            for band in column['bands']:
                if not re.fullmatch(r'[a-f0-9]{32}', str(band.get('id', ''))) or band['id'] in seen:
                    raise Problem('区域标识重复或无效')
                seen.add(band['id'])
                a, b = band.get('top'), band.get('bottom')
                if (not isinstance(a, (int, float)) or not isinstance(b, (int, float))
                        or not math.isfinite(a) or not math.isfinite(b)
                        or abs(a-previous) > .01 or b-a < 2 or b > 1000):
                    raise Problem('分题线交叉、存在空洞或区域过小')
                previous = b
                if type(band.get('skip')) is not bool or band.get('type') not in TYPES:
                    raise Problem('无效的区域类型')
                if band.get('section') not in SECTIONS:
                    raise Problem('请选择题干、答案或解析')
                if band.get('question') and not re.fullmatch(r'[1-9][0-9]{0,3}', str(band['question'])):
                    raise Problem('题号必须是 1 到 9999 的整数')
            if previous != 1000:
                raise Problem('分题区域必须覆盖整栏；空白区请勾选跳过')


def question_groups(job):
    groups = {}
    for page in job['pages']:
        for index, column in enumerate(page['columns']):
            for band in column['bands']:
                if band['skip']:
                    continue
                number = str(band['question'])
                if not number:
                    raise Problem('每个未跳过的区域都需要题号；页眉和答题空白请勾选跳过')
                groups.setdefault(number, []).append({
                    'id': band['id'], 'page': page['id'], 'image': page['image'],
                    'section': band['section'], 'type': band['type'],
                    'bbox': [page['edges'][index], band['top'], page['edges'][index+1], band['bottom']]})
    if not groups:
        raise Problem('没有待处理题目')
    for parts in groups.values():
        if not any(p['section'] == 'content' for p in parts):
            raise Problem('每道题至少要有一个题干区域')
        types = {p['type'] for p in parts if p['type'] != '未知'}
        if len(types) > 1:
            raise Problem('同一题的区域题型不一致')
    return dict(sorted(groups.items(), key=lambda p: int(p[0])))


class Store:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.pool = ThreadPoolExecutor(max_workers=2)
        # PyMuPDF explicitly forbids concurrent threads. Only this child process uses it.
        self.media = ProcessPoolExecutor(max_workers=1, mp_context=multiprocessing.get_context('spawn'))
        # An interrupted paid call is never replayed automatically.
        for file in self.root.glob('*/job.json'):
            try:
                job = json.loads(file.read_text(encoding='utf-8'))
                if job['status'] in ('rendering', 'recognizing'):
                    job.update(status='interrupted', error='服务重启中断任务，请检查已保存结果后手动继续')
                    job['version'] += 1
                    write_json(file, job)
            except (ValueError, KeyError):
                pass

    def directory(self, job_id):
        if not re.fullmatch(r'[a-f0-9]{32}', job_id):
            raise Problem('任务不存在', 404)
        return self.root / job_id

    def get(self, job_id, owner):
        try:
            job = json.loads((self.directory(job_id)/'job.json').read_text(encoding='utf-8'))
        except FileNotFoundError:
            raise Problem('任务不存在', 404)
        if job['owner'] != owner:
            raise Problem('任务不存在', 404)
        return job

    def persist(self, job):
        job['updated'] = time.time()
        write_json(self.directory(job['id'])/'job.json', job)

    def list(self, owner):
        with self.lock:
            items = []
            for file in self.root.glob('*/job.json'):
                job = json.loads(file.read_text(encoding='utf-8'))
                if job['owner'] == owner:
                    items.append({k: job[k] for k in ['id', 'filename', 'status', 'updated']})
            return sorted(items, key=lambda j: j['updated'], reverse=True)[:100]

    def upload(self, owner, name, data, job_id=None):
        suffix = Path(name).suffix.lower()
        if suffix not in ('.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'):
            raise Problem('支持 PDF、DOC、DOCX、PNG、JPG')
        if not data or len(data) > MAX_UPLOAD:
            raise Problem('单文件限制 10MB')
        with self.lock:
            if job_id:
                job = self.get(job_id, owner)
                self.idle(job)
            else:
                job = {'id': uuid.uuid4().hex, 'owner': owner, 'filename': name[:200],
                       'version': 0, 'pages': [], 'results': {}, 'calls': 0, 'usage': [],
                       'metadata': {'title': '', 'year': '0000', 'source': '', 'category': 'N', 'difficulty': ''}}
                self.directory(job['id']).mkdir()
            source = self.directory(job['id']) / (uuid.uuid4().hex + suffix)
            source.write_bytes(data)
            job.update(status='rendering', error='')
            job['version'] += 1
            self.persist(job)
            self.pool.submit(self.render, job['id'], owner, source)
            return job

    @staticmethod
    def idle(job):
        if job['status'] in ('rendering', 'recognizing'):
            raise Problem('任务处理中，请等待完成', 409)

    def render(self, job_id, owner, source):
        try:
            if source.suffix in ('.doc', '.docx'):
                office = os.environ.get('LIBREOFFICE_BIN') or shutil.which('soffice')
                if not office:
                    raise Problem('Word 转换需要安装 LibreOffice 并设置 LIBREOFFICE_BIN')
                profile = source.parent / ('office-' + uuid.uuid4().hex)
                args = [office, '-env:UserInstallation=' + profile.as_uri(), '--headless',
                        '--convert-to', 'pdf', '--outdir', str(source.parent), str(source)]
                subprocess.run(args, capture_output=True, timeout=120, check=True,
                               creationflags=0x08000000 if os.name == 'nt' else 0)
                source = source.with_suffix('.pdf')
            with self.lock:
                count = len(self.get(job_id, owner)['pages'])
            pages = self.media.submit(render_pages, str(source), count).result()
            with self.lock:
                job = self.get(job_id, owner)
                job['pages'].extend(pages)
                job.update(status='ready', error='')
                job['version'] += 1
                self.persist(job)
        except Exception as exc:
            self.fail(job_id, owner, str(exc))

    def fail(self, job_id, owner, message):
        with self.lock:
            job = self.get(job_id, owner)
            job.update(status='failed', error=message[:1500])
            job['version'] += 1
            self.persist(job)

    def save(self, job_id, owner, body):
        with self.lock:
            job = self.get(job_id, owner)
            self.idle(job)
            if body.get('version') != job['version']:
                raise Problem('任务已更新，请重新加载后编辑', 409)
            pages = body.get('pages', [])
            if len(pages) != len(job['pages']):
                raise Problem('不能通过保存增删页面')
            for incoming, stored in zip(pages, job['pages']):
                if any(incoming.get(k) != stored[k] for k in ('id', 'image', 'width', 'height')):
                    raise Problem('原始页面不可修改')
            validate_layout(pages)
            metadata = body.get('metadata', {})
            if set(metadata) != {'title', 'year', 'source', 'category', 'difficulty'}:
                raise Problem('试卷信息字段不完整')
            if any(not isinstance(v, str) or len(v) > 200 or '\n' in v or '\r' in v for v in metadata.values()):
                raise Problem('试卷信息需要单行文字')
            if not re.fullmatch(r'\d{4}', metadata['year']) or metadata['category'] not in ('G', 'E', 'T', 'N'):
                raise Problem('年份或来源类别无效')
            if metadata['difficulty'] not in ['', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']:
                raise Problem('难度必须为 D1 到 D7，未知可留空')
            job['pages'], job['metadata'] = pages, metadata
            # Editing result prose is allowed; provenance and asset paths are server-owned.
            for number, edit in body.get('edits', {}).items():
                if number not in job['results']:
                    raise Problem('结果不存在')
                for field in SECTIONS + ['type']:
                    value = edit.get(field, job['results'][number][field])
                    if not isinstance(value, str) or len(value) > 500_000:
                        raise Problem('题目内容过长或类型无效')
                    if field == 'type' and value not in TYPES:
                        raise Problem('题型无效')
                    job['results'][number][field] = value
            job['version'] += 1
            self.persist(job)
            return job

    def crop(self, job, part, bbox=None):
        return self.media.submit(crop_image, str(self.directory(job['id'])/part['image']), part['bbox'], bbox).result()

    def fingerprint(self, parts):
        return digest([VERSION, MODEL, parts])

    def preview(self, job_id, owner, band_id):
        job = self.get(job_id, owner)
        for page in job['pages']:
            for i, col in enumerate(page['columns']):
                for band in col['bands']:
                    if band['id'] == band_id:
                        return self.crop(job, {'image': page['image'], 'bbox':
                            [page['edges'][i], band['top'], page['edges'][i+1], band['bottom']]})
        raise Problem('区域不存在', 404)

    def start_ocr(self, job_id, owner, body):
        with self.lock:
            job = self.get(job_id, owner)
            self.idle(job)
            if body.get('version') != job['version']:
                raise Problem('请先保存并重新确认任务版本', 409)
            groups = question_groups(job)
            selected = body.get('questions', list(groups))
            if not isinstance(selected, list) or not selected or any(n not in groups for n in selected):
                raise Problem('请选择有效题目')
            pending = [(n, groups[n]) for n in dict.fromkeys(selected)
                       if job['results'].get(n, {}).get('fingerprint') != self.fingerprint(groups[n])]
            size = body.get('batchSize', 3)
            limit = body.get('maxCalls', 1)
            if type(size) is not int or not 1 <= size <= 4 or type(limit) is not int or not 0 <= limit <= 100:
                raise Problem('批次大小 1–4，每次调用上限 0–100')
            if math.ceil(len(pending)/size) > limit:
                raise Problem(f'需要 {math.ceil(len(pending)/size)} 次请求，超过本次上限 {limit}')
            if any(sum(len(parts) for _, parts in pending[i:i+size]) > 16 for i in range(0, len(pending), size)):
                raise Problem('每次请求最多 16 个片段，请减小每批题数或合并多余切块')
            if not pending:
                return job
            if body.get('online') is not True:
                raise Problem('需要明确开启付费识别')
            if not os.environ.get('DASHSCOPE_API_KEY') or not os.environ.get('DASHSCOPE_WORKSPACE_ID'):
                raise Problem('服务端尚未配置百炼 API Key 和 Workspace ID', 503)
            job.update(status='recognizing', error='')
            job['version'] += 1
            self.persist(job)
            self.pool.submit(self.recognize, copy.deepcopy(job), pending, size)
            return job

    def call_model(self, request, response_path):
        workspace = os.environ['DASHSCOPE_WORKSPACE_ID']
        if not re.fullmatch(r'[A-Za-z0-9_-]+', workspace):
            raise Problem('服务端 Workspace ID 格式无效')
        url = f'https://{workspace}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions'
        req = Request(url, data=json.dumps(request, ensure_ascii=False).encode(), headers={
            'Content-Type': 'application/json', 'Authorization': 'Bearer '+os.environ['DASHSCOPE_API_KEY']})
        try:
            with urlopen(req, timeout=240) as response:
                raw = response.read(4*1024*1024)
        except HTTPError as exc:
            raw = exc.read(1024*1024)
            response_path.write_bytes(raw)
            raise Problem(f'模型 HTTP {exc.code}；响应已留档，不会自动重试')
        response_path.write_bytes(raw)
        return json.loads(raw)

    def recognize(self, snapshot, pending, size):
        try:
            for offset in range(0, len(pending), size):
                batch = pending[offset:offset+size]
                content = []
                for number, parts in batch:
                    for part in parts:
                        content.append({'type': 'text', 'text': f'题号 {number}，片段 {part["id"]}，内容段 {part["section"]}，题型 {part["type"]}'})
                        content.append({'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,'+
                            base64.b64encode(self.crop(snapshot, part)).decode()}, 'min_pixels': 65536, 'max_pixels': 2097152})
                prompt = ('忠实识别这些试卷区域，只返回 JSON，不解题、不补写原图不存在的答案或解析。'
                    '同题号多个片段依给定顺序合并；题干、答案、解析根据片段的内容段分别填写。'
                    '保留全部选项和小问，数学用 $ 或 $$ LaTeX。看不清写 [?]。题型只能单选题、多选题、填空题、解答题、未知。'
                    '图表无法转为文字时用 {{asset:唯一id}}，assets 中填写 id、part_id、section、alt、bbox。'
                    'bbox 为相对该原始片段的 [左,上,右,下]，范围0到1000；不要把整道题作为题图。'
                    '没有图片 assets=[]，没有答案和解析填空字符串。输出格式：'
                    '{"questions":[{"number":"1","type":"单选题","content":"原题","answer":"","solution":"","assets":[]}]}。'
                    '返回题号必须恰好为：'+','.join(n for n, _ in batch))
                content.append({'type': 'text', 'text': prompt})
                request = {'model': MODEL, 'messages': [{'role': 'user', 'content': content}],
                           'temperature': 0, 'enable_thinking': False, 'max_tokens': 12000,
                           'response_format': {'type': 'json_object'}}
                attempt = uuid.uuid4().hex
                folder = self.directory(snapshot['id'])
                write_json(folder/(attempt+'_request.json'), request)
                with self.lock:
                    job = self.get(snapshot['id'], snapshot['owner'])
                    job['calls'] += 1  # Count before transmission, including unknown outcomes.
                    self.persist(job)
                response = self.call_model(request, folder/(attempt+'_response.json'))
                usage = response.get('usage', {})
                with self.lock:
                    job = self.get(snapshot['id'], snapshot['owner'])
                    job['usage'].append({'attempt': attempt, 'usage': usage})
                    self.persist(job)
                choice = response['choices'][0]
                if choice.get('finish_reason') != 'stop':
                    raise Problem('模型输出被截断或未正常结束；响应已保留')
                parsed = json.loads(choice['message']['content'])
                results = self.validate_results(snapshot, batch, parsed, attempt)
                with self.lock:
                    job = self.get(snapshot['id'], snapshot['owner'])
                    job['results'].update(results)
                    self.persist(job)
            with self.lock:
                job = self.get(snapshot['id'], snapshot['owner'])
                job.update(status='ready', error='')
                job['version'] += 1
                self.persist(job)
        except Exception as exc:
            self.fail(snapshot['id'], snapshot['owner'], str(exc))

    def validate_results(self, job, batch, parsed, attempt):
        entries = parsed.get('questions')
        if not isinstance(entries, list) or len(entries) != len(batch):
            raise Problem('识别返回题数与切分题数不一致')
        expected = dict(batch)
        results = {}
        for entry in entries:
            number = str(entry.get('number', ''))
            if number not in expected or number in results or entry.get('type') not in TYPES:
                raise Problem('识别返回了错误/重复题号或题型')
            if any(not isinstance(entry.get(s), str) for s in SECTIONS) or not entry['content'].strip():
                raise Problem('识别返回的题干、答案、解析结构不完整')
            parts = {p['id']: p for p in expected[number]}
            for section in ('answer', 'solution'):
                if entry[section].strip() and not any(p['section'] == section for p in parts.values()):
                    raise Problem('模型生成了没有对应原文区域的答案或解析')
            assets = entry.get('assets')
            if not isinstance(assets, list) or len(assets) > 30:
                raise Problem('图片列表无效')
            output = []
            ids = set()
            for asset in assets:
                key = asset.get('id', '')
                part = parts.get(asset.get('part_id'))
                section, bbox = asset.get('section'), asset.get('bbox')
                if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}', key) or key in ids or part is None or section != part['section']:
                    raise Problem('题图来源或标识无效')
                ids.add(key)
                if (not isinstance(bbox, list) or len(bbox) != 4
                        or any(type(x) not in (float, int) or not math.isfinite(x) or not 0 <= x <= 1000 for x in bbox)
                        or bbox[2] <= bbox[0] or bbox[3] <= bbox[1]):
                    raise Problem('题图坐标无效')
                placeholder = '{{asset:'+key+'}}'
                if placeholder not in entry[section]:
                    raise Problem('题图缺少正文引用')
                name = f'T{number}-{attempt[:8]}-{key}.png'
                data = self.crop(job, part, bbox)
                (self.directory(job['id'])/name).write_bytes(data)
                alt = re.sub(r'[\[\]\\\r\n]', '', str(asset.get('alt', '题图')))[:200]
                entry[section] = entry[section].replace(placeholder, f'![{alt}]({name})')
                output.append({'name': name, 'section': section})
            if any('{{asset:' in entry[s] for s in SECTIONS):
                raise Problem('正文包含未生成的题图')
            results[number] = {**{s: entry[s] for s in SECTIONS}, 'type': entry['type'], 'assets': output,
                               'fingerprint': self.fingerprint(expected[number]), 'attempt': attempt}
        return results

    def files(self, job_id, owner, crops=False):
        job = self.get(job_id, owner)
        self.idle(job)
        groups = question_groups(job)
        files = {}
        if crops:
            for number, parts in groups.items():
                for index, part in enumerate(parts):
                    files[f'T{number}-{index+1}-{part["section"]}.png'] = self.crop(job, part)
            files['layout.json'] = json.dumps(job['pages'], ensure_ascii=False).encode()
            return files
        meta = job['metadata']
        if not meta['title'].strip() or not meta['source'].strip():
            raise Problem('请填写完整试卷名称与来源')
        for number, parts in groups.items():
            result = job['results'].get(number)
            if not result or result['fingerprint'] != self.fingerprint(parts):
                raise Problem(f'T{number} 尚未识别，或切分位置已改变，请重新识别')
            if result['type'] == '未知':
                raise Problem(f'T{number} 题型需要确认')
            identifier = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', meta['title']) + 'T' + number
            metadata = {'id': identifier, 'title': identifier, 'year': meta['year'], 'source': meta['source'],
                        'source_category': meta['category'], 'question_type': result['type'], 'number': 'T'+number,
                        'difficulty': meta['difficulty'], 'tags': '', 'curriculum': 'PEP-A-2019', 'chapters': ''}
            text = '---\n' + '\n'.join(k+':'+v for k,v in metadata.items()) + '\n---\n'
            for section in SECTIONS:
                text += '\n'+section+':\n'+result[section].strip()+'\n'
            if not result['assets']:
                text += '\nimg:0\n'
            data = text.encode('utf-8')
            if len(data) > 2*1024*1024:
                raise Problem('MD 超过 2MB')
            assets = {a['name']: (self.directory(job_id)/a['name']).read_bytes() for a in result['assets']}
            for reference in re.findall(r'!\[[^\]\n]*\]\(([^)\n]+)\)', text):
                if reference not in assets:
                    raise Problem(f'T{number} 引用了未知图片：{reference}')
            if any(len(v) > 10*1024*1024 for v in assets.values()) or sum(map(len, assets.values()))+len(data) > 11*1024*1024:
                raise Problem('整题图片过大，请缩减后导入')
            files[identifier+'.md'] = data
            files.update(assets)
        return files


class Handler(BaseHTTPRequestHandler):
    server_version = 'MathSeaDocumentWorker/1'

    def log_message(self, format, *args):
        pass  # Requests may contain private document identifiers.

    def do_GET(self):
        self.handle_api()

    def do_POST(self):
        self.handle_api()

    def do_PUT(self):
        self.handle_api()

    def reply(self, status, data, mime='application/json'):
        if mime == 'application/json':
            data = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self):
        try:
            token = self.headers.get('Authorization', '').removeprefix('Bearer ')
            if not hmac.compare_digest(token, self.server.token):
                raise Problem('未授权', 401)
            owner = self.headers.get('X-Document-Owner', '')
            if not re.fullmatch(r'[0-9]{1,20}', owner):
                raise Problem('缺少用户身份', 401)
            parsed = urlparse(self.path)
            segments = parsed.path.strip('/').split('/')
            store = self.server.store
            size = int(self.headers.get('Content-Length', 0))
            if not 0 <= size <= MAX_UPLOAD:
                raise Problem('请求超过 10MB', 413)
            data = self.rfile.read(size) if size else b''
            if segments == ['health']:
                return self.reply(200, {'ready': True, 'model': MODEL, 'onlineConfigured': bool(os.environ.get('DASHSCOPE_API_KEY') and os.environ.get('DASHSCOPE_WORKSPACE_ID'))})
            if segments == ['jobs']:
                if self.command == 'GET':
                    return self.reply(200, store.list(owner))
                if self.command == 'POST':
                    return self.reply(202, store.upload(owner, parse_qs(parsed.query).get('name', ['upload.pdf'])[0], data))
            if len(segments) >= 2 and segments[0] == 'jobs':
                job_id = segments[1]
                with store.lock:
                    job = store.get(job_id, owner)
                if len(segments) == 2:
                    if self.command == 'GET':
                        return self.reply(200, job)
                    if self.command == 'PUT':
                        return self.reply(200, store.save(job_id, owner, json.loads(data)))
                if len(segments) == 3:
                    action = segments[2]
                    if action == 'append' and self.command == 'POST':
                        return self.reply(202, store.upload(owner, parse_qs(parsed.query).get('name', ['upload.pdf'])[0], data, job_id))
                    if action == 'recognize' and self.command == 'POST':
                        return self.reply(202, store.start_ocr(job_id, owner, json.loads(data)))
                    if action in ('export', 'crops') and self.command == 'GET':
                        files = store.files(job_id, owner, action == 'crops')
                        archive = io.BytesIO()
                        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
                            for name, value in files.items():
                                output.writestr(name, value)
                        return self.reply(200, archive.getvalue(), 'application/zip')
                    if action == 'bundle' and self.command == 'GET':
                        return self.reply(200, [{'name': k, 'base64': base64.b64encode(v).decode()} for k,v in store.files(job_id, owner).items()])
                if len(segments) == 4 and self.command == 'GET':
                    if segments[2] == 'crop':
                        return self.reply(200, store.preview(job_id, owner, segments[3]), 'image/png')
                    if segments[2] == 'image':
                        name = segments[3]
                        allowed = {p['image'] for p in job['pages']} | {a['name'] for r in job['results'].values() for a in r['assets']}
                        if name not in allowed:
                            raise Problem('图片不存在', 404)
                        return self.reply(200, (store.directory(job_id)/name).read_bytes(), 'image/png')
            raise Problem('接口不存在', 404)
        except Problem as exc:
            self.reply(exc.status, {'error': {'code': 'DOCUMENT_WORKER', 'message': str(exc)}})
        except (ValueError, KeyError, TypeError) as exc:
            self.reply(400, {'error': {'code': 'DOCUMENT_INPUT', 'message': '数据格式无效：'+str(exc)[:150]}})
        except Exception:
            logging.exception('Document worker request failed')
            self.reply(500, {'error': {'code': 'DOCUMENT_FAILURE', 'message': '文档服务处理失败，请检查服务日志'}})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=8091, type=int)
    parser.add_argument('--data', default=os.environ.get('DOCUMENT_DATA_DIR', './data'))
    args = parser.parse_args()
    token = os.environ.get('DOCUMENT_WORKER_TOKEN', '')
    if len(token) < 32:
        parser.error('DOCUMENT_WORKER_TOKEN 至少 32 个字符，须与网站后端一致')
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.token, server.store = token, Store(args.data)
    print(f'Document worker listening on {args.host}:{args.port}; API calls require explicit online=true', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
