lazy import os
lazy from fastapi import APIRouter, Request, HTTPException
lazy from fastapi.responses import RedirectResponse
lazy from authlib.integrations.starlette_client import OAuth
lazy import db

router = APIRouter(prefix="/admin", tags=["Auth"])

ALLOWED_ADMINS = ["redaisvibin211@gmail.com"]

oauth = OAuth()
client_id = os.environ.get("GOOGLE_CLIENT_ID")
client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

if client_id and client_secret:
    oauth.register(
        name="google",
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


@router.get("/login")
async def admin_login(request: Request):
    if not hasattr(oauth, "google"):
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    redirect_uri = request.url_for("auth_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def auth_callback(request: Request):
    if not hasattr(oauth, "google"):
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    email = user_info.get("email") if user_info else ""
    client_ip = request.headers.get("X-Forwarded-For") or (
        request.client.host if request.client else "unkown"
    )

    if email in ALLOWED_ADMINS:
        db.log_audit(email, "SUCCESS", client_ip)
        request.session["user"] = email
        return RedirectResponse(url="/admin", status_code=303)
    else:
        db.log_audit(email or "UNKNOWN", "UNAUTHORIZED", client_ip)
        raise HTTPException(status_code=403, detail="Account Not Authorized")


@router.get("/logout")
def admin_logout(request: Request):
    request.session.pop("user", None)
    return RedirectResponse(url="/", status_code=303)
