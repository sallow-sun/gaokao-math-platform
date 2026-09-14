"""Optional real LibreOffice smoke test. Never invokes a model or a website database."""
import io
import os
from pathlib import Path
import shutil
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile

from worker import Store
import pymupdf


def fixture_docx():
    document = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
<w:p><w:r><w:rPr><w:rFonts w:eastAsia="Noto Sans CJK SC"/></w:rPr><w:t>试卷切分测试：数学公式</w:t></w:r></w:p>
<w:p><w:r><w:t>1. Calculate the fraction:</w:t></w:r><m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f><m:r><m:t> + x = 3</m:t></m:r></m:oMath></w:p>
<w:p><w:r><w:t>2. Solve the equation:</w:t></w:r><m:oMath><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup><m:r><m:t> = 4</m:t></m:r></m:oMath></w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr>
</w:body></w:document>'''
    contents = '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'''
    rels = '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
    result = io.BytesIO()
    with zipfile.ZipFile(result, 'w', zipfile.ZIP_DEFLATED) as doc:
        doc.writestr('[Content_Types].xml', contents)
        doc.writestr('_rels/.rels', rels)
        doc.writestr('word/document.xml', document)
    return result.getvalue()


class RealWordTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('LIBREOFFICE_BIN') or shutil.which('soffice'), 'LibreOffice not configured')
    def test_real_docx_equations_render_without_ocr(self):
        with tempfile.TemporaryDirectory(prefix='mathsea-real-word-') as folder:
            store = Store(folder)
            try:
                with patch.object(Store, 'call_model', side_effect=AssertionError('Paid model forbidden')):
                    job = store.upload('1', 'math-smoke.docx', fixture_docx())
                    deadline = time.monotonic()+125
                    while job['status'] == 'rendering' and time.monotonic() < deadline:
                        time.sleep(.1)
                        job = store.get(job['id'], '1')
                self.assertEqual(job['status'], 'ready', job['error'])
                self.assertEqual(len(job['pages']), 1)
                self.assertEqual(job['calls'], 0)
                pdf = next(store.directory(job['id']).glob('*.pdf'))
                with pymupdf.open(pdf) as converted:
                    text = converted[0].get_text()
                    self.assertIn('Calculate', text)
                    self.assertIn('试卷', text)
                    self.assertIn('Solve', text)
                    self.assertIn('x', text)
                    self.assertIn('2', text)
                page = job['pages'][0]
                self.assertGreater(page['width'], 1000)
                preview = os.environ.get('WORD_SMOKE_PREVIEW')
                if preview:
                    shutil.copyfile(store.directory(job['id'])/page['image'], preview)
            finally:
                store.pool.shutdown(wait=True)
                store.media.shutdown(wait=True)


if __name__ == '__main__':
    unittest.main()
