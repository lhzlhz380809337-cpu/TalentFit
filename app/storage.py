"""Small SQLite store. Table names remain compatible with previous TalentFit data."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get('TF_DATA_PATH', ROOT / 'data' / 'talentfit.db'))

def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def timestamp(value):
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat()
    return value

def uid():
    return str(uuid.uuid4())

def dumps(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False)

@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        with conn:
            yield conn
    finally:
        conn.close()

def rows(query, args=()):
    with db() as conn:
        return [dict(r) for r in conn.execute(query, args)]

def one(query, args=()):
    found = rows(query, args)
    return found[0] if found else None

def insert(conn, table, values):
    fields = ','.join('"' + k + '"' for k in values)
    conn.execute(f'INSERT INTO "{table}" ({fields}) VALUES ({",".join("?" for _ in values)})', tuple(values.values()))

def audit(agent, incoming, outgoing, success=True):
    with db() as conn:
        insert(conn, 'AuditLog', dict(id=uid(), agentName=agent, inputPayload=dumps(incoming), outputPayload=dumps(outgoing), validationPassed=success, createdAt=now()))

def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS Job (id TEXT PRIMARY KEY, title TEXT NOT NULL, jobFamily TEXT NOT NULL DEFAULT 'technical', rawText TEXT NOT NULL, requirements TEXT NOT NULL, dimensionWeights TEXT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS Resume (id TEXT PRIMARY KEY, jobId TEXT NOT NULL REFERENCES Job(id), basicInfo TEXT, experiences TEXT NOT NULL, skills TEXT NOT NULL, education TEXT NOT NULL, rawText TEXT NOT NULL, createdAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS DimensionTemplate (id TEXT PRIMARY KEY, name TEXT NOT NULL, dimensionKey TEXT UNIQUE NOT NULL, jobFamily TEXT NOT NULL DEFAULT 'general', verifiable BOOLEAN NOT NULL DEFAULT 1, maxScore INTEGER NOT NULL DEFAULT 5, weight REAL NOT NULL DEFAULT 1, anchors TEXT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS Score (id TEXT PRIMARY KEY, resumeId TEXT NOT NULL REFERENCES Resume(id), dimensionId TEXT NOT NULL REFERENCES DimensionTemplate(id), candidateLevel INTEGER NOT NULL, requiredLevel INTEGER NOT NULL, evidence TEXT NOT NULL, verifiable BOOLEAN NOT NULL DEFAULT 1, confidence TEXT NOT NULL DEFAULT 'medium', gapNote TEXT, createdAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS InterviewQuestion (id TEXT PRIMARY KEY, scoreId TEXT NOT NULL REFERENCES Score(id), dimensionId TEXT NOT NULL REFERENCES DimensionTemplate(id), gapType TEXT NOT NULL, question TEXT NOT NULL, whatToListenFor TEXT NOT NULL, createdAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS MatchReport (id TEXT PRIMARY KEY, jobId TEXT NOT NULL, resumeId TEXT UNIQUE NOT NULL, reportJson TEXT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS AppConfig (id TEXT PRIMARY KEY, configKey TEXT UNIQUE NOT NULL, configValue TEXT NOT NULL, updatedAt DATETIME NOT NULL);
        CREATE TABLE IF NOT EXISTS AuditLog (id TEXT PRIMARY KEY, agentName TEXT NOT NULL, inputPayload TEXT NOT NULL, outputPayload TEXT NOT NULL, validationPassed BOOLEAN NOT NULL DEFAULT 0, errorMessage TEXT, createdAt DATETIME NOT NULL);
        CREATE INDEX IF NOT EXISTS Resume_jobId_idx ON Resume(jobId);
        CREATE INDEX IF NOT EXISTS Score_resumeId_idx ON Score(resumeId);
        ''')
        for template in json.loads((ROOT / 'app' / 'dimensions.json').read_text(encoding='utf-8')):
            if conn.execute('SELECT id FROM DimensionTemplate WHERE dimensionKey=?', (template['dimensionKey'],)).fetchone():
                continue
            insert(conn, 'DimensionTemplate', dict(template, id=uid(), anchors=dumps(template['anchors']), createdAt=now(), updatedAt=now()))

def templates():
    result = rows('SELECT * FROM DimensionTemplate ORDER BY createdAt,id')
    for row in result:
        row['anchors'] = json.loads(row['anchors'])
        row['verifiable'] = bool(row['verifiable'])
    return result

def delete_candidate(conn, candidate_id):
    conn.execute('DELETE FROM InterviewQuestion WHERE scoreId IN (SELECT id FROM Score WHERE resumeId=?)', (candidate_id,))
    conn.execute('DELETE FROM Score WHERE resumeId=?', (candidate_id,))
    conn.execute('DELETE FROM MatchReport WHERE resumeId=?', (candidate_id,))
    conn.execute('DELETE FROM Resume WHERE id=?', (candidate_id,))
