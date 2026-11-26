lazy from fastapi import APIRouter, Request
lazy from fastapi.responses import HTMLResponse, RedirectResponse
lazy import db

router = APIRouter(tags=["pages"])


def get_templates(request: Request):
    return request.app.state.templates


@router.get("/", response_class=HTMLResponse)
def index(request: Request):
    templates = get_templates(request)
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "announcements": db.get_announcements(10),
            "projects": db.get_projects(12),
            "schedules": db.get_sched(10),
            "user": request.session.get("user"),
        },
    )


@router.get("/admin", response_class=HTMLResponse)
def admin_panel(request: Request):
    user = request.session.get("user")
    if not user:
        return RedirectResponse(url="/admin/login", status_code=303)
    templates = get_templates(request)
    return templates.TemplateResponse(
        request=request,
        name="admin.html",
        context={
            "user": user,
            "announcements": db.get_announcements(20),
            "projects": db.get_projects(20),
            "schedules": db.get_sched(20),
            "logs": db.get_audit_logs(20),
        },
    )


@router.get("/announcements", response_class=HTMLResponse)
def all_announcements(request: Request):
    user = request.session.get("user")
    templates = get_templates(request)
    return templates.TemplateResponse(
        request=request,
        name="announcements.html",
        context={
            "user": user,
            "announcements": db.get_announcements(),
        },
    )


@router.get("/projects", response_class=HTMLResponse)
def all_projects(request: Request):
    user = request.session.get("user")
    templates = get_templates(request)
    return templates.TemplateResponse(
        request=request,
        name="projects.html",
        context={"user": user, "projects": db.get_projects()},
    )


@router.get("/schedules", response_class=HTMLResponse)
def all_scheds(request: Request):
    user = request.session.get("user")
    templates = get_templates(request)
    return templates.TemplateResponse(
        request=request,
        name="schedules.html",
        context={"user": user, "schedules": db.get_sched()},
    )
