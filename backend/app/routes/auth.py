"""/api/auth — HF OAuth login flow + session lookup.

Endpoints:

  GET  /api/auth/login     — set state cookie, 302 to HF authorize URL
  GET  /api/auth/callback  — verify state, exchange code, set session cookie, 302 to /
  GET  /api/auth/me        — return current session (or 401 with body)
  POST /api/auth/logout    — clear session cookie

The frontend only ever calls /api/auth/me; the other endpoints are
hit via full-page navigation because OAuth requires a top-level redirect.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import get_settings
from app.services import auth_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth")


def _request_origin(request: Request) -> str | None:
    """Reconstruct the scheme://host origin from headers. With our
    Dockerfile's --proxy-headers + --forwarded-allow-ips='*' the scheme
    is already https in production."""
    host = request.url.netloc or request.headers.get("host")
    if not host:
        return None
    scheme = request.url.scheme or "https"
    return f"{scheme}://{host}"


def _is_https(request: Request) -> bool:
    return (request.url.scheme or "").lower() == "https"


@router.get("/login")
async def login(request: Request) -> Response:
    """Kick off the OAuth dance. Browser is redirected to HF authorize
    URL with a state we stash in a short-lived signed cookie."""
    settings = get_settings()
    if not settings.oauth_enabled:
        # User-facing — keep the message generic. Operator docs cover
        # the README hf_oauth recipe.
        return JSONResponse(
            {"detail": "Sign-in is not available on this deployment."},
            status_code=503,
        )
    state = auth_service.mint_state()
    code_verifier = auth_service.mint_code_verifier()
    code_challenge = auth_service.code_challenge_for(code_verifier)
    state_token = auth_service.encode_state(state, code_verifier)
    target = auth_service.build_authorize_url(
        state, code_challenge, _request_origin(request),
    )
    resp = RedirectResponse(target, status_code=302)
    resp.set_cookie(
        auth_service.STATE_COOKIE,
        state_token,
        max_age=auth_service.STATE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_is_https(request),
        path="/api/auth",
    )
    return resp


@router.get("/callback")
async def callback(
    request: Request, code: str | None = None, state: str | None = None,
    error: str | None = None, error_description: str | None = None,
) -> Response:
    """OAuth redirect target. Verify state, exchange code, set session
    cookie, redirect home. Errors are surfaced as a redirect to / with
    an ?auth_error= query so the frontend can show a banner."""
    # Generic, user-facing message regardless of the underlying cause —
    # we log the real exception/HF-error server-side and surface a
    # short, neutral string in the URL bar where the user can read
    # (and copy-paste into bug reports) without leaking upstream HF
    # response bodies or internal endpoint paths.
    GENERIC_ERROR = "sign-in+failed.+please+try+again."

    if error:
        logger.info("OAuth provider returned error=%r description=%r", error, error_description)
        return RedirectResponse(f"/?auth_error={GENERIC_ERROR}", status_code=302)
    if not code or not state:
        logger.info("OAuth callback missing code or state")
        return RedirectResponse(f"/?auth_error={GENERIC_ERROR}", status_code=302)
    expected_state, code_verifier = auth_service.decode_state(
        request.cookies.get(auth_service.STATE_COOKIE)
    )
    if not expected_state or not code_verifier or expected_state != state:
        logger.warning("OAuth state mismatch or missing PKCE verifier on callback")
        return RedirectResponse(f"/?auth_error={GENERIC_ERROR}", status_code=302)

    try:
        user = await auth_service.exchange_code_for_user(
            code, code_verifier, _request_origin(request),
        )
    except auth_service.AuthError as exc:
        logger.info("OAuth exchange failed: %s", exc)
        return RedirectResponse(f"/?auth_error={GENERIC_ERROR}", status_code=302)

    session_token = auth_service.encode_session(user)
    resp = RedirectResponse("/?logged_in=1", status_code=302)
    resp.delete_cookie(auth_service.STATE_COOKIE, path="/api/auth")
    resp.set_cookie(
        auth_service.SESSION_COOKIE,
        session_token,
        max_age=auth_service.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_is_https(request),
        path="/",
    )
    logger.info("Login OK for user=%s", user.username)
    return resp


@router.get("/me")
async def me(request: Request) -> Response:
    """Return the current logged-in user, or 401 with an empty body if
    no session. The frontend polls this on boot to decide whether to
    show the Login button or the avatar."""
    cookie = request.cookies.get(auth_service.SESSION_COOKIE)
    user = auth_service.decode_session(cookie)
    if not user:
        return JSONResponse({"detail": "Not logged in."}, status_code=401)
    settings = get_settings()
    return JSONResponse(
        {
            "username": user.username,
            "avatar_url": user.avatar_url,
            "expires_at": user.expires_at,
            "persistence_enabled": settings.persistence_enabled,
            "user_data_repo": (
                settings.user_data_repo if settings.persistence_enabled else None
            ),
        }
    )


@router.post("/logout")
async def logout(request: Request) -> Response:
    """Clear the session cookie. Idempotent."""
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth_service.SESSION_COOKIE, path="/")
    return resp


@router.get("/status")
async def status() -> Response:
    """Public read-only: is OAuth wired up on this deployment, and is
    persistence enabled? Used by the frontend to decide whether to show
    the Login button at all (e.g. hide in local dev)."""
    settings = get_settings()
    return JSONResponse(
        {
            "oauth_enabled": settings.oauth_enabled,
            "persistence_enabled": settings.persistence_enabled,
            "provider": settings.openid_provider_url,
        }
    )
