lazy import os
lazy from fastapi import FastAPI
lazy from fastapi.templating import Jinja2Templates
lazy from fastapi.staticfiles import StaticFiles
lazy from starlette.middleware.sessions import SessionMiddleware
lazy import db
lazy from routers import pages, auth, admin_api, chat
lazy from jinja2 import pass_context

app = FastAPI(title="Lycee Dakhla", version="2.0.0")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get(
        "FLASK_SECRET_KEY", "lycee-dakhla-permanent-secret-998877"
    ),
    max_age=30 * 24 * 60 * 60,
    same_site="lax",
    https_only=bool(os.environ.get("VERCEL")),
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount(
    "/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static"
)
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
app.state.templates = templates
_orig_url_for = templates.env.globals["url_for"]


@pass_context
def flask_compat_url_for(request, name, **path_params):
    if "filename" in path_params:
        path_params["path"] = path_params.pop("filename")
    return _orig_url_for(request, name, **path_params)


templates.env.globals["url_for"] = flask_compat_url_for
try:
    db.init_db()
except Exception as err:
    print(f"Database initialization warning: {err}")

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(admin_api.router)
app.include_router(chat.router)
