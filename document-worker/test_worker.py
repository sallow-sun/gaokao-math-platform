"""Offline regression suite: outbound model traffic is always forbidden/mocked."""
import copy
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import uuid

import pymupdf
from worker import Store, Handler, ThreadingHTTPServer, Problem, new_band, question_groups, validate_layout


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mathsea-document-test-')
        self.store = Store(self.temp.name)
        # This guard guarantees that regression tests cannot spend real API credits.
        self.network = patch.object(Store, 'call_model', side_effect=AssertionError('REAL OCR FORBIDDEN'))
        self.network.start()

    def tearDown(self):
        self.store.pool.shutdown(wait=True)
        self.store.media.shutdown(wait=True)
        self.network.stop()
        self.temp.cleanup()

    def fixture(self, questions=2):
        job_id, page_id = uuid.uuid4().hex, uuid.uuid4().hex
        folder = self.store.directory(job_id)
        folder.mkdir()
        doc = pymupdf.open()
        p = doc.new_page(width=400, height=600)
        p.draw_rect(pymupdf.Rect(200, 300, 400, 600), color=(1, 0, 0), fill=(1, 0, 0))
        p.get_pixmap().save(folder/(page_id+'.png'))
        doc.close()
        bands = [new_band(i*1000/questions, (i+1)*1000/questions) for i in range(questions)]
        for i, band in enumerate(bands):
            band.update(question=str(i+1), type='填空题')
        job = {'id': job_id, 'owner': '1', 'filename': 'fixture.pdf', 'version': 1, 'status': 'ready', 'error': '',
               'pages': [{'id': page_id, 'image': page_id+'.png', 'width': 400, 'height': 600,
                          'edges': [0, 1000], 'columns': [{'bands': bands, 'suggestions': []}]}],
               'metadata': {'title': '2026年测试卷数学', 'year': '2026', 'source': '本地测试', 'category': 'N', 'difficulty': ''},
               'results': {}, 'calls': 0, 'usage': []}
        self.store.persist(job)
        return job

    def wait_ready(self, job):
        deadline = time.monotonic()+15
        while time.monotonic() < deadline:
            current = self.store.get(job['id'], '1')
            if current['status'] not in ('rendering', 'recognizing'):
                return current
            time.sleep(.025)
        self.fail('Background task timed out')

    def reply(self, request, path):
        numbers = request['messages'][0]['content'][-1]['text'].split('返回题号必须恰好为：')[1].split(',')
        self.assertEqual(request['max_tokens'], 12000)
        self.assertFalse(request['enable_thinking'])
        response = {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({'questions': [
            {'number': n, 'type': '填空题', 'content': '$1+2=$____。', 'answer': '', 'solution': '', 'assets': []} for n in numbers]})}}],
                    'usage': {'prompt_tokens': 100, 'completion_tokens': 50}}
        path.write_text(json.dumps(response), encoding='utf-8')
        return response

    def recognize(self, job, **kwargs):
        with patch.dict(os.environ, {'DASHSCOPE_API_KEY': 'fake-test-only', 'DASHSCOPE_WORKSPACE_ID': 'fake'}):
            self.store.start_ocr(job['id'], '1', {'version': job['version'], 'online': True, 'maxCalls': 2, 'batchSize': 2, **kwargs})
            return self.wait_ready(job)

    def test_pdf_render_and_append_without_ocr(self):
        doc = pymupdf.open()
        doc.new_page(width=200, height=300).insert_text((20, 30), '1. Find x.')
        raw = doc.tobytes()
        doc.close()
        job = self.wait_ready(self.store.upload('1', 'first.pdf', raw))
        self.assertEqual(job['status'], 'ready', job['error'])
        self.assertEqual((job['pages'][0]['width'], job['pages'][0]['height']), (500, 750))
        first = job['pages'][0]['id']
        job = self.wait_ready(self.store.upload('1', 'answers.pdf', raw, job['id']))
        self.assertEqual(len(job['pages']), 2)
        self.assertEqual(job['pages'][0]['id'], first)
        self.assertEqual(job['calls'], 0)
        validate_layout(job['pages'])

    def test_owner_path_and_version_are_checked(self):
        job = self.fixture()
        for identifier, owner in [(job['id'], '2'), ('../secrets', '1')]:
            with self.assertRaises(Problem) as error:
                self.store.get(identifier, owner)
            self.assertEqual(error.exception.status, 404)
        body = {'version': 0, 'pages': job['pages'], 'metadata': job['metadata']}
        with self.assertRaises(Problem) as error:
            self.store.save(job['id'], '1', body)
        self.assertEqual(error.exception.status, 409)
        body['version'] = 1
        body['metadata']['category'] = ''
        with self.assertRaises(Problem):
            self.store.save(job['id'], '1', body)

    def test_overlap_missing_number_and_missing_content_rejected(self):
        job = self.fixture()
        job['pages'][0]['columns'][0]['bands'][1]['top'] = 499
        with self.assertRaises(Problem): validate_layout(job['pages'])
        job = self.fixture()
        job['pages'][0]['columns'][0]['bands'][0]['question'] = ''
        with self.assertRaises(Problem): question_groups(job)
        job['pages'][0]['columns'][0]['bands'][0].update(question='1', section='answer')
        with self.assertRaises(Problem): question_groups(job)

    def test_crop_preserves_original_pixels_and_relative_asset_coordinates(self):
        job = self.fixture()
        data = self.store.crop(job, {'image': job['pages'][0]['image'], 'bbox': [500, 500, 1000, 1000]})
        pix = pymupdf.Pixmap(data)
        self.assertEqual((pix.width, pix.height), (200, 300))
        self.assertEqual(pix.pixel(100, 150), (255, 0, 0))
        data = self.store.crop(job, {'image': job['pages'][0]['image'], 'bbox': [0, 0, 1000, 1000]}, [500, 500, 1000, 1000])
        self.assertEqual(pymupdf.Pixmap(data).pixel(100, 150), (255, 0, 0))

    def test_budget_is_checked_before_credentials_or_requests(self):
        job = self.fixture(4)
        with self.assertRaisesRegex(Problem, '超过本次上限'):
            self.store.start_ocr(job['id'], '1', {'version': 1, 'online': True, 'batchSize': 2, 'maxCalls': 1})
        self.assertEqual(self.store.get(job['id'], '1')['calls'], 0)

    def test_batched_ocr_cache_and_md14_export(self):
        job = self.fixture(4)
        with patch.object(self.store, 'call_model', side_effect=self.reply) as mocked:
            job = self.recognize(job)
            self.assertEqual(job['status'], 'ready', job['error'])
            self.assertEqual(mocked.call_count, 2)
            again = self.recognize(job, maxCalls=0)
            self.assertEqual(mocked.call_count, 2)
        self.assertEqual(again['calls'], 2)
        files = self.store.files(job['id'], '1')
        self.assertEqual(len(files), 4)
        md = files['2026年测试卷数学T1.md'].decode()
        self.assertIn('question_type:填空题', md)
        self.assertIn('number:T1', md)
        self.assertIn('answer:\n\n', md)
        self.assertIn('img:0', md)
        self.assertEqual(md, (Path(__file__).parent/'fixtures/expected.md').read_text(encoding='utf-8'))
        self.assertEqual(len(job['usage']), 2)

    def test_failure_keeps_previous_batch_and_retry_only_missing(self):
        job = self.fixture(4)
        count = 0
        def model(request, path):
            nonlocal count
            count += 1
            if count == 2: raise OSError('simulated reset')
            return self.reply(request, path)
        with patch.object(self.store, 'call_model', side_effect=model): job = self.recognize(job)
        self.assertEqual(job['status'], 'failed')
        self.assertEqual(set(job['results']), {'1', '2'})
        self.assertEqual(job['calls'], 2)
        with patch.object(self.store, 'call_model', side_effect=self.reply) as model:
            job = self.recognize(job, maxCalls=1)
            self.assertEqual(model.call_count, 1)
        self.assertEqual(len(job['results']), 4)

    def test_boundary_change_invalidates_only_affected_cache(self):
        job = self.fixture(4)
        with patch.object(self.store, 'call_model', side_effect=self.reply): job = self.recognize(job)
        bands = job['pages'][0]['columns'][0]['bands']
        bands[0]['bottom'] = bands[1]['top'] = 260
        job = self.store.save(job['id'], '1', job)
        with self.assertRaisesRegex(Problem, '切分位置已改变'): self.store.files(job['id'], '1')
        with patch.object(self.store, 'call_model', side_effect=self.reply) as model:
            job = self.recognize(job, maxCalls=1)
            self.assertEqual(model.call_count, 1)
        self.assertEqual(len(self.store.files(job['id'], '1')), 4)

    def test_hallucinated_answer_wrong_number_and_truncation_rejected(self):
        job = self.fixture(1)
        parts = list(question_groups(job).items())
        entry = {'number': '1', 'type': '填空题', 'content': '题目', 'answer': '3', 'solution': '', 'assets': []}
        with self.assertRaisesRegex(Problem, '没有对应原文'): self.store.validate_results(job, parts, {'questions': [entry]}, uuid.uuid4().hex)
        entry.update(number='2', answer='')
        with self.assertRaises(Problem): self.store.validate_results(job, parts, {'questions': [entry]}, uuid.uuid4().hex)
        def truncated(request, path):
            response = self.reply(request, path)
            response['choices'][0]['finish_reason'] = 'length'
            return response
        with patch.object(self.store, 'call_model', side_effect=truncated): job = self.recognize(job)
        self.assertEqual(job['status'], 'failed')
        self.assertEqual(job['results'], {})

    def test_assets_and_manual_corrections_export_with_provenance(self):
        job = self.fixture(1)
        batch = list(question_groups(job).items())
        entry = {'number': '1', 'type': '填空题', 'content': '如图 {{asset:fig}}', 'answer': '', 'solution': '',
                 'assets': [{'id': 'fig', 'part_id': batch[0][1][0]['id'], 'section': 'content', 'alt': '图', 'bbox': [500, 500, 1000, 1000]}]}
        job['results'] = self.store.validate_results(job, batch, {'questions': [entry]}, uuid.uuid4().hex)
        self.store.persist(job)
        edited = self.store.save(job['id'], '1', {**job, 'edits': {'1': {'content': '更正 '+job['results']['1']['content']}}})
        files = self.store.files(job['id'], '1')
        self.assertEqual(len(files), 2)
        self.assertIn('更正', next(data for name, data in files.items() if name.endswith('.md')).decode())
        self.assertEqual(edited['results']['1']['fingerprint'], job['results']['1']['fingerprint'])

    def test_restart_never_replays_paid_request(self):
        job = self.fixture()
        job.update(status='recognizing', calls=1)
        self.store.persist(job)
        recovered = Store(self.temp.name)
        try:
            value = recovered.get(job['id'], '1')
            self.assertEqual(value['status'], 'interrupted')
            self.assertEqual(value['calls'], 1)
        finally:
            recovered.pool.shutdown()
            recovered.media.shutdown()

    def test_word_without_converter_reports_actionable_error(self):
        with patch.dict(os.environ, {'LIBREOFFICE_BIN': ''}), patch('worker.shutil.which', return_value=None):
            job = self.wait_ready(self.store.upload('1', 'test.docx', b'fake-docx'))
        self.assertEqual(job['status'], 'failed')
        self.assertIn('LibreOffice', job['error'])
        self.assertEqual(job['calls'], 0)

    def test_word_converter_contract_uses_isolated_profile_and_pdf_renderer(self):
        def convert(args, **kwargs):
            self.assertIn('--headless', args)
            self.assertTrue(args[1].startswith('-env:UserInstallation=file:'))
            self.assertEqual(kwargs['timeout'], 120)
            source = Path(args[-1])
            doc = pymupdf.open()
            doc.new_page(width=200, height=300)
            doc.save(source.with_suffix('.pdf'))
            doc.close()
        with patch.dict(os.environ, {'LIBREOFFICE_BIN': 'fake-office'}), patch('worker.subprocess.run', side_effect=convert):
            job = self.wait_ready(self.store.upload('1', 'test.docx', b'fake-docx'))
        self.assertEqual(job['status'], 'ready', job['error'])
        self.assertEqual(len(job['pages']), 1)
        self.assertEqual(job['calls'], 0)

    def test_http_requires_token_and_owner_and_serves_no_arbitrary_files(self):
        job = self.fixture()
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.token, server.store = 'x'*32, self.store
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        root = f'http://127.0.0.1:{server.server_port}'
        headers = {'Authorization': 'Bearer '+'x'*32, 'X-Document-Owner': '1'}
        try:
            with self.assertRaises(HTTPError) as error: urlopen(root+'/health')
            self.assertEqual(error.exception.code, 401)
            error.exception.close()
            with urlopen(Request(root+'/jobs/'+job['id'], headers=headers)) as response:
                self.assertEqual(json.load(response)['id'], job['id'])
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(root+'/jobs/'+job['id']+'/image/job.json', headers=headers))
            self.assertEqual(error.exception.code, 404)
            error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
