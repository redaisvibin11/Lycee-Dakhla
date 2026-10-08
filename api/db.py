import os
import sqlite3

import requests

IS_VERCEL = bool(os.environ.get("VERCEL"))
DB_NAME = os.path.join(os.path.dirname(os.path.abspath(__file__)), "school.db")

TURSO_URL = (os.environ.get("TURSO_DATABASE_URL") or "").strip()
TURSO_TOKEN = (os.environ.get("TURSO_AUTH_TOKEN") or "").strip()

# libsql:// works for the websocket client; the HTTP API needs https://
if TURSO_URL.startswith("libsql://"):
    TURSO_URL = "https://" + TURSO_URL[len("libsql://") :]
TURSO_URL = TURSO_URL.rstrip("/")

USE_TURSO = bool(TURSO_URL and TURSO_TOKEN)

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        status TEXT NOT NULL,
        ip_address TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        signature TEXT DEFAULT 'Le Proviseur',
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        student_name TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
]

_schema_ready = False


# ---------- Turso over HTTP ----------
def _to_arg(value):
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "integer", "value": str(int(value))}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    return {"type": "text", "value": str(value)}


def _from_cell(cell):
    kind = cell.get("type")
    if kind == "null":
        return None
    if kind == "integer":
        return int(cell["value"])
    if kind == "float":
        return float(cell["value"])
    return cell.get("value")


def _turso_run(sql, params=()):
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {"sql": sql, "args": [_to_arg(p) for p in params]},
            },
            {"type": "close"},
        ]
    }
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        json=payload,
        headers={"Authorization": f"Bearer {TURSO_TOKEN}"},
        timeout=10,
    )
    resp.raise_for_status()
    result = resp.json()["results"][0]
    if result["type"] == "error":
        raise RuntimeError(f"Turso error: {result['error']['message']}")

    res = result["response"]["result"]
    cols = [c["name"] for c in res["cols"]]
    return [dict(zip(cols, [_from_cell(c) for c in row])) for row in res["rows"]]


# ---------- local SQLite (only for running on your own PC) ----------
def _local_run(sql, params=()):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()] if cur.description else []
        conn.commit()
        return rows
    finally:
        conn.close()


def _run(sql, params=()):
    if USE_TURSO:
        return _turso_run(sql, params)
    if IS_VERCEL:
        raise RuntimeError(
            "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are missing on Vercel. "
            "Add them in Settings > Environment Variables and redeploy."
        )
    return _local_run(sql, params)


def init_db():
    global _schema_ready
    if _schema_ready:
        return
    for stmt in SCHEMA:
        _run(stmt)
    _schema_ready = True


def execute_write(query, params=()):
    init_db()
    _run(query, params)


def execute_read(query, params=()):
    init_db()
    return _run(query, params)


# ---------- audit logs ----------
def log_audit(email, status, ip_address):
    query = "INSERT INTO audit_logs (email, status, ip_address) VALUES (?, ?, ?)"
    execute_write(query, (email, status, ip_address))


def get_audit_logs(limit=20):
    query = "SELECT email, status, ip_address, timestamp FROM audit_logs ORDER BY id DESC LIMIT ?"
    return execute_read(query, (limit,))


# ---------- announcements ----------
def add_announcement(title, content, signature="Le Proviseur", image_url=""):
    query = "INSERT INTO announcements (title, content, signature, image_url) VALUES (?, ?, ?, ?)"
    execute_write(query, (title, content, signature, image_url))


def get_announcements(limit=10):
    query = "SELECT id, title, content, signature, image_url, created_at FROM announcements ORDER BY id DESC LIMIT ?"
    return execute_read(query, (limit,))


def delete_announcement(announcement_id):
    execute_write("DELETE FROM announcements WHERE id = ?", (announcement_id,))


# ---------- projects ----------
def add_project(title, student_name, description, image_url=""):
    query = "INSERT INTO projects (title, student_name, description, image_url) VALUES (?, ?, ?, ?)"
    execute_write(query, (title, student_name, description, image_url))


def get_projects(limit=12):
    query = "SELECT id, title, student_name, description, image_url, created_at FROM projects ORDER BY id DESC LIMIT ?"
    return execute_read(query, (limit,))


def delete_project(project_id):
    execute_write("DELETE FROM projects WHERE id = ?", (project_id,))
