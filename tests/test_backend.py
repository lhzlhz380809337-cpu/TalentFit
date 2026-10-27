import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
import storage as store
import models
import server
from documents import extract_text

def pdf(text):
    stream = f'BT /F1 12 Tf 40 760 Td ({text}) Tj ET'
    objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream']
    result = '%PDF-1.4\n'; offsets = []
    for i, obj in enumerate(objects):
        offsets.append(len(result)); result += f'{i + 1} 0 obj\n{obj}\nendobj\n'
    xref = len(result)
    result += 'xref\n0 6\n0000000000 65535 f \n' + ''.join(f'{o:010d} 00000 n \n' for o in offsets) + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'
    return result.encode()

class FakeAI(BaseHTTPRequestHandler):
    calls = 0
    fail_interview = False
    def log_message(self, *args):
        pass
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        type(self).calls += 1
        prompt, user = data['messages'][0]['content'], data['messages'][1]['content']
        templates = store.templates()
        if '岗位分析师' in prompt:
            content = dict(jobTitle='测试工程师', jobFamily='technical', requirements=[dict(mappedDimension=t['dimensionKey'], targetLevel=3, description='独立完成项目', priority='must_have', ksaType='skill') for t in templates], dimensionWeights=[dict(dimensionId=t['dimensionKey'], weight=1/7) for t in templates])
        elif '简历分析师' in prompt:
            content = dict(basicInfo=dict(name=user.split('\n')[0]), experiences=[dict(company='Test', role='Engineer', period='2020-2025', rawText=user)], skills=['Python'], education=['本科'])
        elif '胜任力评估' in prompt:
            time.sleep(.1)
            content = dict(dimensionScores=[dict(dimensionId=t['dimensionKey'], candidateLevel=3, requiredLevel=5, evidence='未在简历中找到相关描述', candidateLevelReason='独立完成项目', confidence='high') for t in templates])
        elif '面试问题' in prompt:
            if type(self).fail_interview:
                self.send_response(500); self.end_headers(); return
            content = [dict(dimensionId=templates[0]['id'], dimensionName=templates[0]['name'], gapType='unverifiable', question='请介绍相关项目的具体行动和成果', whatToListenFor='可核实的成果')]
        else:
            content = 'ok'
        result = json.dumps(dict(choices=[dict(message=dict(content=json.dumps(content, ensure_ascii=False) if not isinstance(content, str) else content))])).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(result)

class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='talentfit-test-')
        store.DB_PATH = Path(cls.temp.name) / 'test.db'
        os.environ['TF_API_KEY'] = ''
        store.initialize()
        cls.fake = ThreadingHTTPServer(('127.0.0.1', 0), FakeAI)
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        for instance in (cls.fake, cls.http):
            threading.Thread(target=instance.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}/api'
    @classmethod
    def tearDownClass(cls):
        for instance in (cls.fake, cls.http):
            instance.shutdown(); instance.server_close()
        cls.temp.cleanup()
    def request(self, path, method='GET', body=None, headers=None):
        h = headers or {}
        if isinstance(body, dict):
            body = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
        try:
            with urlopen(Request(self.base + path, data=body, method=method, headers=h), timeout=30) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            with error:
                return error.code, json.load(error)
    def upload(self, job, filename, content):
        body = b'--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="' + filename.encode() + b'"\r\nContent-Type: application/octet-stream\r\n\r\n' + content + b'\r\n--test-boundary--\r\n'
        return self.request(f'/jobs/{job}/candidates', 'POST', body, {'Content-Type': 'multipart/form-data; boundary=test-boundary'})
    def test_real_flow(self):
        settings = [dict(key='api_key', value='test-key-only'), dict(key='model_name', value='mock'), dict(key='api_endpoint', value=f'http://127.0.0.1:{self.fake.server_port}')]
        self.assertTrue(self.request('/settings', 'PUT', dict(settings=settings))[1]['success'])
        self.assertEqual(self.request('/settings', 'PUT', dict(settings=settings), {'Origin': 'https://unrelated.example'})[0], 403)
        job = self.request('/jobs', 'POST', dict(rawText='岗位要求独立完成项目并协调各部门。'))[1]['data']['id']
        other = self.request('/jobs', 'POST', dict(rawText='另一个岗位，要求具有项目实践经验。'))[1]['data']['id']
        word = io.BytesIO()
        with zipfile.ZipFile(word, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX candidate with five years of independent project experience.</w:t></w:r></w:p></w:body></w:document>')
        text = '张三\n独立完成软件项目并协调多个部门，具有五年项目经验。'.encode()
        files = [('张三.txt', text), ('resume.pdf', pdf('PDF candidate with five years of project experience.')), ('resume.docx', word.getvalue())]
        with ThreadPoolExecutor(max_workers=3) as pool:
            uploads = list(pool.map(lambda f: self.upload(job, *f), files))
        for status, body in uploads:
            self.assertEqual(status, 201, body)
        cid = uploads[0][1]['data']['id']
        self.assertEqual(self.upload(job, 'repeat.txt', text)[1]['data']['id'], cid)
        self.assertEqual(self.upload(job, 'bad.doc', b'not a word document')[0], 422)
        self.assertEqual(self.upload(job, 'bad.pdf', b'not a pdf document')[0], 422)
        self.assertEqual(self.upload(job, 'large.txt', b'a' * (10 * 1024 * 1024 + 1))[0], 422)
        self.assertEqual(self.request(f'/jobs/{other}/candidates/{cid}/score', 'POST')[0], 404)
        score_path = f'/jobs/{job}/candidates/{cid}/score'
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.request, score_path, 'POST')
            time.sleep(.03)
            self.assertEqual(self.request(score_path, 'POST')[0], 409)
            status, body = first.result()
        self.assertEqual(status, 200, body)
        self.assertEqual(body['data']['overallMatch'], 100)
        self.assertTrue(all(d['requiredLevel'] == 3 for d in body['data']['dimensionScores']))
        before = FakeAI.calls
        report_path = f'/jobs/{job}/candidates/{cid}/report'
        self.assertEqual(self.request(report_path)[1]['data']['overallMatch'], 100)
        self.assertEqual(FakeAI.calls, before)
        self.assertTrue(self.upload(job, 'repeat-again.txt', text)[1]['data']['scored'])
        old = store.rows('SELECT * FROM Score WHERE resumeId=?', (cid,))
        FakeAI.fail_interview = True
        try:
            self.assertEqual(self.request(score_path, 'POST')[0], 422)
            self.assertEqual(store.rows('SELECT * FROM Score WHERE resumeId=?', (cid,)), old)
        finally:
            FakeAI.fail_interview = False
        logs = self.request('/audit-logs')[1]
        self.assertIn('pagination', logs)
        self.assertNotIn('test-key-only', json.dumps(logs))
        self.assertEqual(self.request(f'/jobs/{other}/candidates/{cid}', 'DELETE')[0], 404)
        self.assertEqual(self.request(f'/jobs/{job}/candidates/{cid}', 'DELETE')[0], 200)
        self.assertIsNone(store.one('SELECT id FROM MatchReport WHERE resumeId=?', (cid,)))
        self.assertEqual(self.request(f'/jobs/{job}', 'DELETE')[0], 200)
    def test_weighted_scale(self):
        self.assertEqual(models.weighted_match([dict(candidateLevel=3, requiredLevel=3)]), 100)
        self.assertEqual(models.weighted_match([dict(candidateLevel=5, requiredLevel=3), dict(candidateLevel=1, requiredLevel=3)]), 67)
        self.assertEqual(models.weighted_match([dict(candidateLevel=1, requiredLevel=4, weight=3), dict(candidateLevel=4, requiredLevel=4, weight=1)]), 44)
        self.assertEqual(models.weighted_match([]), 0)
    def test_text_encodings(self):
        text = '测试简历，独立负责工艺改进并取得量化结果。'
        for encoding in ('utf-8-sig', 'utf-16', 'gb18030'):
            self.assertEqual(extract_text(text.encode(encoding), '简历.txt'), text)
    def test_existing_settings_survive_initialization(self):
        with store.db() as conn:
            conn.execute("INSERT OR REPLACE INTO AppConfig VALUES ('keep','custom-setting','keep-value',1234567890000)")
        store.initialize()
        self.assertEqual(store.one("SELECT configValue FROM AppConfig WHERE configKey='custom-setting'")['configValue'], 'keep-value')
        self.assertEqual(len(store.templates()), 7)
        self.assertEqual(store.timestamp(1234567890000)[:4], '2009')

if __name__ == '__main__':
    unittest.main()
