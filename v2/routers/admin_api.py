lazy import os
lazy import uuid
lazy import requests
lazy from typing import Optional
lazy from fastapi import (
    APIRouter,
    Request,
    Form,
    File,
    UploadFile,
    Depends,
    HTTPException,
)
lazy from fastapi.responses import RedirectResponse
lazy import db

router = APIRouter(prefix="/api/admin", tags=["Admin API"])

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "svg"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def require_admin(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not Authorized")
    return user


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


async def save_uploaded_image(upload: Optional[UploadFile]) -> str:
    if not upload or not upload.filename or not allowed_file(upload.filename):
        return ""
    try:
        ext = upload.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        file_bytes = await upload.read()

        blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN")
        if blob_token:
            resp = requests.put(
                f"https://blob.vercel-storage.com/{filename}",
                headers={
                    "Authorization": f"Bearer {blob_token}",
                    "x-access": "public",
                },
                data=file_bytes,
                timeout=15,
            )
            if resp.status_code == 200:
                return resp.json().get("url", "")
        local_upload_dir = os.path.join(BASE_DIR, "static", "uploads")
        os.makedirs(local_upload_dir, exist_ok=True)
        filepath = os.path.join(local_upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return f"/static/uploads/{filename}"
    except Exception as e:
        print(f"File save error: {e}")
        return ""


async def handle_image_input(upload: Optional[UploadFile], url_string: str) -> str:
    saved = await save_uploaded_image(upload)
    if saved:
        return saved
    if url_string and url_string.strip():
        return url_string.strip()
    return ""


# --- Anouncements ---
@router.post("/announcements/new")
async def post_announcement(
    title: str = Form(""),
    content: str = Form(""),
    signature: str = Form("Le Proviseur"),
    image_file: Optional[UploadFile] = File(None),
    image_url: str = Form(""),
    user: str = Depends(require_admin),
):
    if title.strip() and content.strip():
        final_img = await handle_image_input(image_file, image_url)
        db.add_announcement(
            title.strip(), content.strip(), signature.strip(), final_img
        )
    return RedirectResponse(url="/admin", status_code=303)


@router.post("/announcements/delete/{item_id}")
def remove_announcement(item_id: int, user: str = Depends(require_admin)):
    db.delete_announcement(item_id)
    return RedirectResponse(url="/admin", status_code=303)


# --- Projects ---
@router.post("/projects/new")
async def post_projects(
    title: str = Form(""),
    student_name: str = Form(""),
    description: str = Form(""),
    image_file: Optional[UploadFile] = File(None),
    image_url: str = Form(""),
    user: str = Depends(require_admin),
):
    if title.strip() and description.strip():
        final_img = await handle_image_input(image_file, image_url)
        db.add_project(
            title.strip(), student_name.strip(), description.strip(), final_img
        )
    return RedirectResponse(url="/admin", status_code=303)


@router.post("/projects/delete/{item_id}")
def remove_project(item_id: int, user: str = Depends(require_admin)):
    db.delete_project(item_id)
    return RedirectResponse(url="/admin", status_code=303)


# --- Schedules ---
@router.post("/schedules/new")
async def post_sched(
    title: str = Form(""),
    class_: str = Form(""),
    image_file: Optional[UploadFile] = File(None),
    image_url: str = Form(""),
    user: str = Depends(require_admin),
):
    if title.strip() and class_.strip():
        final_img = await handle_image_input(image_file, image_url)
        db.add_sched(title.strip(), class_.strip(), final_img)
    return RedirectResponse(url="/admin", status_code=303)


@router.post("/schedules/delete/{item_id}")
def remove_sched(item_id: int, user: str = Depends(require_admin)):
    db.delete_sched(item_id)
    return RedirectResponse(url="/admin", status_code=303)
