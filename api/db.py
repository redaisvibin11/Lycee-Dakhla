import os
import sqlite3

try:
    import libsql_client
except ImportError:
    libsql_client = None

DB_NAME = os.path.join(os.path.dirname(__file__), "school.db")
TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")


def get_remote_client():
    if libsql_client and TURSO_URL and TURSO_TOKEN:
        try:
            return libsql_client.create_client_sync(
                url=TURSO_URL, auth_token=TURSO_TOKEN
            )
        except Exception as err:
            print(f"Turso Connection Error: {err}")
    return None


def get_local_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def execute_write(query, params=()):
    remote_client = get_remote_client()
    if remote_client:
        try:
            remote_client.execute(query, params)
        except Exception as err:
            print(f"Turso write error: {err}")

    try:
        conn = get_local_db()
        conn.execute(query, params)
        conn.commit()
        conn.close()
    except Exception as err:
        print(f"Local write error: {err}")


def execute_read(query, params=()):
    remote_client = get_remote_client()
    if remote_client:
        try:
            result = remote_client.execute(query, params)
            columns = result.columns
            return [dict(zip(columns, row)) for row in result.rows]
        except Exception as err:
            print(f"Turso read error: {err}")

    conn = get_local_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if not os.path.exists(schema_path):
        return

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    statements = [stmt.strip() for stmt in schema_sql.split(";") if stmt.strip()]

    remote_client = get_remote_client()
    if remote_client:
        for stmt in statements:
            try:
                remote_client.execute(stmt)
            except Exception as err:
                print(f"Turso init error: {err}")

    conn = get_local_db()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()


def log_audit(email, status, ip_address):
    query = "INSERT INTO audit_logs (email, status, ip_address) VALUES (?, ?, ?)"
    execute_write(query, (email, status, ip_address))


def get_audit_logs(limit=20):
    query = "SELECT email, status, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT ?"
    return execute_read(query, (limit,))


def add_announcement(title, content, signature="Le Proviseur", image_url=""):
    query = "INSERT INTO announcements (title, content, signature, image_url) VALUES (?, ?, ?, ?)"
    execute_write(query, (title, content, signature, image_url))


def get_announcements(limit=10):
    query = "SELECT id, title, content, signature, image_url, created_at FROM announcements ORDER BY created_at DESC LIMIT ?"
    return execute_read(query, (limit,))


def delete_announcement(announcement_id):
    query = "DELETE FROM announcements WHERE id = ?"
    execute_write(query, (announcement_id,))


def add_project(title, student_name, description, image_url=""):
    query = "INSERT INTO projects (title, student_name, description, image_url) VALUES (?, ?, ?, ?)"
    execute_write(query, (title, student_name, description, image_url))


def get_projects(limit=12):
    query = "SELECT id, title, student_name, description, image_url, created_at FROM projects ORDER BY created_at DESC LIMIT ?"
    return execute_read(query, (limit,))


def delete_project(project_id):
    query = "DELETE FROM projects WHERE id = ?"
    execute_write(query, (project_id,))
