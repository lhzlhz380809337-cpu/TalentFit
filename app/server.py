"""TalentFit local HTTP service: Python standard library + pypdf."""
import hashlib
import json
import mimetypes
import os
import re
import threading
from contextlib import contextmanager
from email.parser import BytesParser
from email import policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import storage as store
import models
from documents import extract_text, MAX_FILE

_running = set()
_lock = threading.Lock()

class APIError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status

@contextmanager
def operation(key):
    with _lock:
        if key in _running:
            raise APIError(409, '相同任务正在处理，请稍后刷新。')
        _running.add(key)
    try:
        yield
    finally:
        with _lock:
            _running.discard(key)

def require_job(job_id):
    job = store.one('SELECT * FROM Job WHERE id=?', (job_id,))
    if not job:
        raise APIError(404, '岗位不存在。')
    return job

def require_resume(job_id, candidate_id):
    resume = store.one('SELECT * FROM Resume WHERE id=? AND jobId=?', (candidate_id, job_id))
    if not resume:
        raise APIError(404, '候选人不存在。')
    return resume

def report_for(job, resume):
    snapshot = store.one('SELECT * FROM MatchReport WHERE resumeId=?', (resume['id'],))
    if not snapshot:
        raise APIError(404, '尚无完整报告，请先执行匹配。')
    return models.normalize_report(json.loads(snapshot['reportJson']), job, store.templates())

def candidates_for(job):
    templates = store.templates()
    candidates = []
    for r in store.rows('SELECT * FROM Resume WHERE jobId=? ORDER BY createdAt DESC', (job['id'],)):
        snapshot = store.one('SELECT reportJson FROM MatchReport WHERE resumeId=?', (r['id'],))
        match = models.normalize_report(json.loads(snapshot['reportJson']), job, templates)['overallMatch'] if snapshot else None
        candidates.append(dict(id=r['id'], name=json.loads(r['basicInfo'] or '{}').get('name') or '未知', matchScore=match, status='scored' if match is not None else 'pending', createdAt=store.timestamp(r['createdAt'])))
    return candidates

class Handler(BaseHTTPRequestHandler):
    server_version = 'TalentFit/2'
    def send_json(self, value, status=200):
        data = store.dumps(value).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 <= length <= MAX_FILE + 65536:
            raise APIError(413, '上传内容超过 10 MB。')
        return self.rfile.read(length)

    def json_body(self):
        try:
            data = json.loads(self.body() or b'{}')
            if not isinstance(data, dict):
                raise ValueError()
            return data
        except (ValueError, UnicodeDecodeError) as error:
            raise APIError(400, '请求 JSON 格式不正确。') from error

    def do_GET(self):
        self.dispatch()
    def do_POST(self):
        self.dispatch()
    def do_PUT(self):
        self.dispatch()
    def do_DELETE(self):
        self.dispatch()

    def dispatch(self):
        try:
            origin = self.headers.get('Origin')
            if origin and urlparse(origin).netloc != self.headers.get('Host') and origin not in ('http://127.0.0.1:5174', 'http://localhost:5174'):
                raise APIError(403, '不允许来自其他网站的请求。')
            url = urlparse(self.path)
            if not url.path.startswith('/api/'):
                if self.command != 'GET':
                    raise APIError(405, '不支持此操作。')
                return self.static_file(url.path)
            data, status = self.route(url.path, parse_qs(url.query))
            if status:
                self.send_json(dict(success=True, data=data), status)
        except APIError as error:
            self.send_json(dict(success=False, error=str(error)), error.status)
        except ValueError as error:
            self.send_json(dict(success=False, error=str(error)), 422)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            print(f'Error: {type(error).__name__}: {error}', flush=True)
            self.send_json(dict(success=False, error='处理失败，请重试；详情见运行日志。'), 500)

    def static_file(self, request_path):
        dist = Path(os.environ.get('TF_DIST_PATH', store.ROOT / 'dist')).resolve()
        target = (dist / request_path.lstrip('/')).resolve()
        if not target.is_relative_to(dist):
            raise APIError(404, '页面不存在。')
        if not target.is_file():
            target = dist / 'index.html'
        if not target.exists():
            raise APIError(503, '界面文件缺失，请重新解压完整程序。')
        content = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def route(self, path, query):
        method = self.command
        if path == '/api/health' and method == 'GET':
            self.send_json(dict(success=True, app='TalentFit', instance=os.environ.get('TF_INSTANCE', 'development'), message='ok'))
            return None, 0
        if path == '/api/templates' and method == 'GET':
            return store.templates(), 200
        if path == '/api/settings':
            if method == 'GET':
                return [dict(key=r['configKey'], value=r['configValue']) for r in store.rows('SELECT * FROM AppConfig')], 200
            if method == 'PUT':
                settings = self.json_body().get('settings')
                allowed = {'api_provider', 'api_endpoint', 'api_key', 'model_name', 'temperature', 'max_tokens'}
                if not isinstance(settings, list) or any(not isinstance(i, dict) or i.get('key') not in allowed or not isinstance(i.get('value'), str) for i in settings):
                    raise APIError(400, '配置内容格式不正确。')
                with store.db() as conn:
                    for item in settings:
                        conn.execute('INSERT INTO AppConfig (id,configKey,configValue,updatedAt) VALUES (?,?,?,?) ON CONFLICT(configKey) DO UPDATE SET configValue=excluded.configValue, updatedAt=excluded.updatedAt', (store.uid(), item['key'], item['value'], store.now()))
                return {}, 200
        if path == '/api/settings/test-connection' and method == 'POST':
            try:
                preview = models.call_ai('只回复ok', 'ping', test=True)
                return dict(success=True, message='连接成功', responsePreview=preview), 200
            except ValueError as error:
                return dict(success=False, message=str(error)), 200
        if path == '/api/audit-logs' and method == 'GET':
            page = max(1, int(query.get('page', ['1'])[0]))
            size = min(100, max(1, int(query.get('pageSize', ['20'])[0])))
            agent = query.get('agentName', [''])[0]
            where, args = ('WHERE agentName=?', (agent,)) if agent else ('', ())
            total = store.one(f'SELECT COUNT(*) AS n FROM AuditLog {where}', args)['n']
            logs = store.rows(f'SELECT * FROM AuditLog {where} ORDER BY createdAt DESC LIMIT ? OFFSET ?', args + (size, (page - 1) * size))
            for log in logs:
                log['inputPayload'] = json.loads(log['inputPayload'])
                # Old databases may contain keys written by previous releases.
                if isinstance(log['inputPayload'], dict) and isinstance(log['inputPayload'].get('config'), dict):
                    log['inputPayload']['config']['apiKey'] = '[redacted]'
                log['outputPayload'] = json.loads(log['outputPayload'])
                log['createdAt'] = store.timestamp(log['createdAt'])
            # Frontend expects pagination alongside data.
            self.send_json(dict(success=True, data=logs, pagination=dict(page=page, pageSize=size, total=total, totalPages=(total + size - 1) // size)))
            return None, 0
        if path == '/api/jobs':
            if method == 'GET':
                jobs = store.rows('SELECT Job.*, COUNT(Resume.id) AS candidateCount FROM Job LEFT JOIN Resume ON Resume.jobId=Job.id GROUP BY Job.id ORDER BY Job.createdAt DESC')
                return [dict(id=j['id'], title=j['title'], jobFamily=j['jobFamily'], candidateCount=j['candidateCount'], createdAt=store.timestamp(j['createdAt'])) for j in jobs], 200
            if method == 'POST':
                body = self.json_body()
                raw = body.get('rawText')
                if not isinstance(raw, str) or len(raw.strip()) < 10:
                    raise APIError(400, 'JD 原文至少 10 个字符。')
                jd = models.parse_jd(raw)
                title = str(body.get('title') or jd['jobTitle']).strip()
                if len(title) > 100:
                    raise APIError(400, '岗位名称最多 100 个字符。')
                job = dict(id=store.uid(), title=title, rawText=raw, jobFamily=jd['jobFamily'], requirements=store.dumps(jd['requirements']), dimensionWeights=store.dumps(jd['dimensionWeights']), createdAt=store.now(), updatedAt=store.now())
                with store.db() as conn:
                    store.insert(conn, 'Job', job)
                return job, 201
        match = re.fullmatch(r'/api/jobs/([^/]+)(?:/candidates(?:/([^/]+)(?:/(score|report))?)?)?', path)
        if not match:
            raise APIError(404, '接口不存在。')
        job_id, candidate_id, action = match.groups()
        job = require_job(job_id)
        if path == '/api/jobs/' + job_id:
            if method == 'GET':
                return dict(job, requirements=json.loads(job['requirements']), dimensionWeights=json.loads(job['dimensionWeights']), candidates=candidates_for(job)), 200
            if method == 'DELETE':
                with store.db() as conn:
                    for resume in conn.execute('SELECT id FROM Resume WHERE jobId=?', (job_id,)).fetchall():
                        store.delete_candidate(conn, resume['id'])
                    conn.execute('DELETE FROM Job WHERE id=?', (job_id,))
                return dict(id=job_id), 200
        if not candidate_id:
            if method == 'GET':
                return candidates_for(job), 200
            if method == 'POST':
                return self.upload(job_id)
        resume = require_resume(job_id, candidate_id)
        if action == 'report' and method == 'GET':
            return report_for(job, resume), 200
        if action == 'score' and method == 'POST':
            with operation('score:' + candidate_id):
                report = models.score_report(job, resume)
                with store.db() as conn:
                    if not conn.execute('SELECT id FROM Resume WHERE id=? AND jobId=?', (candidate_id, job_id)).fetchone():
                        raise APIError(404, '候选人已被删除。')
                    conn.execute('DELETE FROM InterviewQuestion WHERE scoreId IN (SELECT id FROM Score WHERE resumeId=?)', (candidate_id,))
                    conn.execute('DELETE FROM Score WHERE resumeId=?', (candidate_id,))
                    for score in report['dimensionScores']:
                        score_id = store.uid()
                        values = {k: score[k] for k in ('dimensionId', 'candidateLevel', 'requiredLevel', 'evidence', 'verifiable', 'confidence')}
                        store.insert(conn, 'Score', dict(values, id=score_id, resumeId=candidate_id, gapNote=score.get('gapNote'), createdAt=store.now()))
                        for q in report['interviewQuestions']:
                            if q['dimensionId'] == score['dimensionId']:
                                store.insert(conn, 'InterviewQuestion', dict(id=store.uid(), scoreId=score_id, dimensionId=q['dimensionId'], gapType=q['gapType'], question=q['question'], whatToListenFor=q['whatToListenFor'], createdAt=store.now()))
                    conn.execute('INSERT INTO MatchReport (id,jobId,resumeId,reportJson,createdAt,updatedAt) VALUES (?,?,?,?,?,?) ON CONFLICT(resumeId) DO UPDATE SET reportJson=excluded.reportJson,updatedAt=excluded.updatedAt', (store.uid(), job_id, candidate_id, store.dumps(report), store.now(), store.now()))
                return report, 200
        if action is None and method == 'DELETE':
            with store.db() as conn:
                store.delete_candidate(conn, candidate_id)
            return dict(id=candidate_id), 200
        raise APIError(405, '不支持此操作。')

    def upload(self, job_id):
        content_type = self.headers.get('Content-Type', '')
        if content_type.startswith('multipart/form-data'):
            message = BytesParser(policy=policy.default).parsebytes(('Content-Type: ' + content_type + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + self.body())
            files = [part for part in message.iter_parts() if part.get_filename() and part.get_param('name', header='content-disposition') == 'file']
            if len(files) != 1:
                raise APIError(400, '每个上传任务必须包含一个简历文件。')
            part = files[0]
            raw = extract_text(part.get_payload(decode=True), part.get_filename())
        else:
            raw = self.json_body().get('rawText')
        if not isinstance(raw, str) or not 10 <= len(raw.strip()) <= 500000:
            raise APIError(400, '简历文字须为 10–500000 个字符。')
        raw = raw.strip()
        with operation('parse:' + hashlib.sha256((job_id + raw).encode()).hexdigest()):
            existing = store.one('SELECT * FROM Resume WHERE jobId=? AND rawText=?', (job_id, raw))
            if existing:
                scored = bool(store.one('SELECT id FROM MatchReport WHERE resumeId=?', (existing['id'],)))
                return dict(id=existing['id'], name=json.loads(existing['basicInfo'] or '{}').get('name') or '未知', reused=True, scored=scored), 200
            parsed = models.parse_resume(raw)
            candidate_id = store.uid()
            with store.db() as conn:
                store.insert(conn, 'Resume', dict(id=candidate_id, jobId=job_id, rawText=raw, createdAt=store.now(), **{k: store.dumps(parsed[k]) for k in ('basicInfo', 'experiences', 'skills', 'education')}))
            return dict(id=candidate_id, name=parsed['basicInfo']['name'] or '未知'), 201

def main():
    store.initialize()
    server = ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PORT', '17840'))), Handler)
    print(f'TalentFit ready on http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
