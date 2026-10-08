import sqlite3
import os

DB_NAME = "school.db"


def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()


def log_audit(email, status, ip_address):
    conn = get_db()
    conn.execute(
        "INSERT INTO audit_logs (email, status, ip_address) VALUES (?, ?, ?)",
        (email, status, ip_address),
    )
    conn.commit()
    conn.close()


def get_audit_logs(limit=20):
    conn = get_db()
    rows = conn.execute(
        "SELECT email, status, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_announcement(title, content, signature="Le Proviseur", image_url=""):
    conn = get_db()
    conn.execute(
        "INSERT INTO announcements (title, content, signature, image_url) VALUES (?, ?, ?, ?)",
        (title, content, signature, image_url),
    )
    conn.commit()
    conn.close()


def get_announcements(limit=10):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, content, signature, image_url, created_at FROM announcements ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_announcement(announcement_id):
    conn = get_db()
    conn.execute("DELETE FROM announcements WHERE id = ?", (announcement_id,))
    conn.commit()
    conn.close()


# --- Projects Gallery ---
def add_project(title, student_name, description, image_url=""):
    conn = get_db()
    conn.execute(
        "INSERT INTO projects (title, student_name, description, image_url) VALUES (?, ?, ?, ?)",
        (title, student_name, description, image_url),
    )
    conn.commit()
    conn.close()


def get_projects(limit=12):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, student_name, description, image_url, created_at FROM projects ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_project(project_id):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
