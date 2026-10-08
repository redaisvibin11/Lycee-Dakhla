import sqlite3
import os

# Store DB in /tmp when on Vercel (read-only environment), or local school.db on PC
if os.environ.get("VERCEL"):
    DB_NAME = "/tmp/school.db"
else:
    DB_NAME = os.path.join(os.path.dirname(__file__), "school.db")


def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    # Only initialize tables if database file doesn't exist yet in /tmp
    conn = get_db()
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
    conn.commit()
    conn.close()
