import os
import sys
from datetime import timedelta
from functools import wraps
from flask import (
    Flask,
    Response,
    jsonify,
    request,
    session,
    redirect,
    url_for,
    render_template,
)

api_dir = os.path.dirname(__file__)
if api_dir not in sys.path:
    sys.path.append(api_dir)

import db

root_dir = os.path.abspath(os.path.join(api_dir, ".."))
template_dir = os.path.join(api_dir, "templates")

app = Flask(
    __name__, template_folder=template_dir, static_folder=root_dir, static_url_path=""
)

app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY", "lycee-dakhla-permanent-secret-998877"
)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

ALLOWED_ADMINS = ["proviseur.lyceedakhla@gmail.com", "redaisvibin211@gmail.com"]

try:
    db.init_db()
except Exception as err:
    app.logger.error(f"Database initialization warning: {err}")

google = None
try:
    from authlib.integrations.flask_client import OAuth

    oauth = OAuth(app)
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if client_id and client_secret:
        google = oauth.register(
            name="google",
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
except Exception as err:
    app.logger.error(f"OAuth configuration warning: {err}")


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)

    return decorated_function


@app.route("/")
def index_page():
    return render_template("index.html", user=session.get("user"))


@app.route("/api/announcements", methods=["GET"])
def fetch_announcements():
    return jsonify(db.get_announcements(10))


@app.route("/api/projects", methods=["GET"])
def fetch_projects():
    return jsonify(db.get_projects(12))


@app.route("/admin")
@admin_required
def admin_panel():
    announcements = db.get_announcements(20)
    projects = db.get_projects(20)
    logs = db.get_audit_logs(20)
    return render_template(
        "admin.html",
        user=session.get("user"),
        announcements=announcements,
        projects=projects,
        logs=logs,
    )


@app.route("/admin/login")
def admin_login():
    if not google:
        return "Google OAuth non configuré sur le serveur.", 500
    redirect_uri = url_for("auth_callback", _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route("/admin/callback")
def auth_callback():
    if not google:
        return "Google OAuth non configuré.", 500
    token = google.authorize_access_token()
    user_info = token.get("userinfo")
    email = user_info.get("email") if user_info else ""
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)

    if email in ALLOWED_ADMINS:
        db.log_audit(email, "SUCCESS", client_ip)
        session.permanent = True
        session["user"] = email
        return redirect("/admin")
    else:
        db.log_audit(email or "UNKNOWN", "UNAUTHORIZED", client_ip)
        return "Accès refusé : ce compte Google n'est pas autorisé.", 403


@app.route("/admin/logout")
def admin_logout():
    session.pop("user", None)
    return redirect("/")


@app.route("/api/admin/announcements/new", methods=["POST"])
@admin_required
def post_announcement():
    title = request.form.get("title", "").strip()
    content = request.form.get("content", "").strip()
    signature = request.form.get("signature", "Le Proviseur").strip()
    image_url = request.form.get("image_url", "").strip()

    if title and content:
        db.add_announcement(title, content, signature, image_url)
    return redirect("/admin")


@app.route("/api/admin/announcements/delete/<int:item_id>", methods=["POST"])
@admin_required
def remove_announcement(item_id):
    db.delete_announcement(item_id)
    return redirect("/admin")


@app.route("/api/admin/projects/new", methods=["POST"])
@admin_required
def post_project():
    title = request.form.get("title", "").strip()
    student_name = request.form.get("student_name", "").strip()
    description = request.form.get("description", "").strip()
    image_url = request.form.get("image_url", "").strip()

    if title and student_name and description:
        db.add_project(title, student_name, description, image_url)
    return redirect("/admin")


@app.route("/api/admin/projects/delete/<int:item_id>", methods=["POST"])
@admin_required
def remove_project(item_id):
    db.delete_project(item_id)
    return redirect("/admin")


@app.route("/api/index", methods=["POST"])
def answer():
    from google import genai
    from google.genai import types

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Écris d'abord une question."}), 400

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Clé API non configurée."}), 500

    client = genai.Client(api_key=api_key)
    announcements = db.get_announcements(limit=3)
    ann_text = (
        "\n".join(
            [
                f"- [{a['created_at']}] {a['title']}: {a['content']}"
                for a in announcements
            ]
        )
        if announcements
        else "Aucune annonce récente."
    )

    system_prompt = f"""You are Najm, the friendly AI assistant for Lycée Dakhla in Boujniba, Morocco.

Annonces récentes:
{ann_text}
"""

    def generate():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-3.6-flash",
                contents=text,
                config=types.GenerateContentConfig(system_instruction=system_prompt),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception:
            yield "Najm est incapable de répondre à cette question."

    return Response(generate(), mimetype="text/plain")


if __name__ == "__main__":
    app.run(port=7860, debug=True)
