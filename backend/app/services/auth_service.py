"""HF OAuth session helpers.

Why a tiny custom OAuth client instead of authlib? We need exactly three
things — build an authorize URL, exchange code for token+userinfo,
sign/verify session cookies — and authlib's session-based API drags in
Starlette session middleware that fights with our cookie strategy.
Direct httpx + itsdangerous is ~80 lines and clearer to audit.

Session storage strategy:

  * Signed cookie (itsdangerous URLSafeTimedSerializer)
  * Payload is small: {sub, username, avatar, exp}
  * We do NOT store the HF access_token in the cookie — we don't need
    it after the initial /me lookup. Less to leak.
  * The session_secret comes from the SESSION_SECRET env var (HF
    Space secret); fresh-random in dev.

Cookies:

  * Name: ``quda_session``
  * HttpOnly, SameSite=Lax, Secure-when-https
  * Default max-age 8h, matching the HF token lifetime

Threats considered:

  * CSRF on the OAuth callback → state cookie + signed
  * Cookie tampering → itsdangerous signature
  * Session fixation → state is per-login random
  * XSS exfiltration → HttpOnly + we don't put anything sensitive in
    the cookie payload anyway
"""

from __future__ import annotations

import base64
import hashlib
import logging
import re
import secrets
import time
from dataclasses import dataclass
from typing import Any

import httpx
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import get_settings

logger = logging.getLogger(__name__)

SESSION_COOKIE = "quda_session"
STATE_COOKIE = "quda_oauth_state"

# Sessions valid for 8 hours, matching the HF token expiration we set
# in README frontmatter (hf_oauth_expiration_minutes: 480).
SESSION_MAX_AGE_SECONDS = 8 * 3600
# OAuth state + verifier cookie is short-lived: it has to survive the
# round-trip through HF's authorize → callback flow but no longer.
STATE_MAX_AGE_SECONDS = 600  # 10 minutes
# Outbound HTTP timeout when talking to HF's /oauth/{token,userinfo}.
HF_OAUTH_TIMEOUT_SECONDS = 15.0

# Authorization URL endpoint paths off the openid_provider_url.
_AUTHORIZE_PATH = "/oauth/authorize"
_TOKEN_PATH = "/oauth/token"
_USERINFO_PATH = "/oauth/userinfo"

# HF usernames are restricted server-side. We re-validate before using
# the value as a directory name / plugin namespace so a compromised
# OAuth response can't escape into "../" or weird Unicode.
_HF_USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,38}$")


class AuthError(Exception):
    """Surfaced to the route layer as a 400/401 with a clear message."""


@dataclass(frozen=True)
class SessionUser:
    sub: str           # HF user opaque id (immutable across renames)
    username: str      # HF username, validated against _HF_USERNAME_RE
    avatar_url: str | None
    expires_at: int    # unix seconds


# ---- Session cookie -----------------------------------------------------

def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret, salt="quda-session-v1")


def encode_session(user: SessionUser) -> str:
    """Encode a SessionUser as a signed token suitable for a cookie."""
    return _serializer().dumps(
        {
            "sub": user.sub,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "exp": user.expires_at,
        }
    )


def decode_session(token: str | None) -> SessionUser | None:
    """Decode a session cookie. Returns None if missing, invalid, or
    expired."""
    if not token:
        return None
    try:
        payload = _serializer().loads(
            token, max_age=SESSION_MAX_AGE_SECONDS
        )
    except SignatureExpired:
        return None
    except BadSignature:
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and exp < time.time():
        return None
    username = payload.get("username")
    if not isinstance(username, str) or not _HF_USERNAME_RE.match(username):
        return None
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        return None
    avatar = payload.get("avatar_url")
    if avatar is not None and not isinstance(avatar, str):
        avatar = None
    return SessionUser(
        sub=sub,
        username=username,
        avatar_url=avatar,
        expires_at=int(exp) if isinstance(exp, (int, float)) else int(time.time()),
    )


# ---- OAuth flow --------------------------------------------------------

def _redirect_uri(request_origin: str | None) -> str:
    """Compute the OAuth callback URI.

    Preference order:
      1. Explicit Space host from SPACE_HOST env var (set by HF)
      2. Origin observed on the inbound request (dev / port-forward)
      3. Hardcoded fallback so the URL is at least well-formed
    """
    settings = get_settings()
    if settings.space_host:
        return f"https://{settings.space_host}/api/auth/callback"
    if request_origin:
        return f"{request_origin.rstrip('/')}/api/auth/callback"
    return "https://qudastudio-app.hf.space/api/auth/callback"


def build_authorize_url(
    state: str, code_challenge: str, request_origin: str | None,
) -> str:
    """Build the URL we redirect the browser to for HF login.

    Includes PKCE (RFC 7636) parameters: ``code_challenge`` is the
    SHA-256 hash of a random verifier we keep in a server-side signed
    cookie. The verifier travels back to HF on the token exchange,
    proving the callback is happening in the same browser that started
    the login. This binds the OAuth flow to the user agent even if an
    attacker can otherwise plant cookies (e.g. via HTTPS-stripping
    intermediary)."""
    settings = get_settings()
    if not settings.oauth_enabled:
        raise AuthError(
            "OAuth not configured on this deployment. "
            "Set hf_oauth: true in the Space README frontmatter."
        )
    params = httpx.QueryParams(
        {
            "client_id": settings.oauth_client_id,
            "redirect_uri": _redirect_uri(request_origin),
            "response_type": "code",
            "scope": "openid profile",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{settings.openid_provider_url}{_AUTHORIZE_PATH}?{params}"


def mint_state() -> str:
    """Per-login random state, stored in a short-lived signed cookie
    and verified on callback to defeat CSRF on the OAuth handshake."""
    return secrets.token_urlsafe(24)


def mint_code_verifier() -> str:
    """PKCE code_verifier — 43-128 chars of unreserved characters per
    RFC 7636. We use 64 random bytes urlsafe-encoded (~86 chars)."""
    return secrets.token_urlsafe(64)


def code_challenge_for(verifier: str) -> str:
    """PKCE code_challenge = base64url(sha256(verifier)) without
    padding (RFC 7636 §4.2)."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def encode_state(state: str, code_verifier: str) -> str:
    """Sign and pack the per-login secrets into one cookie value.
    Bundling state + verifier in a single cookie means a forged state
    cookie is useless without the verifier — they have to be valid
    together."""
    return _serializer().dumps(
        {"state": state, "code_verifier": code_verifier}
    )


def decode_state(token: str | None) -> tuple[str | None, str | None]:
    """Returns (state, code_verifier) or (None, None) on invalid/
    expired cookie."""
    if not token:
        return None, None
    try:
        payload = _serializer().loads(token, max_age=STATE_MAX_AGE_SECONDS)
    except (SignatureExpired, BadSignature):
        return None, None
    if not isinstance(payload, dict):
        return None, None
    st = payload.get("state")
    cv = payload.get("code_verifier")
    if isinstance(st, str) and isinstance(cv, str):
        return st, cv
    return None, None


async def exchange_code_for_user(
    code: str, code_verifier: str, request_origin: str | None,
) -> SessionUser:
    """POST the code + PKCE verifier to HF /oauth/token, then GET
    /userinfo with the resulting access_token. Returns a normalized
    SessionUser.

    Raises AuthError with a user-facing string on any failure so the
    route can return a 400 with the original message.
    """
    settings = get_settings()
    if not settings.oauth_enabled:
        raise AuthError("OAuth not configured.")
    redirect_uri = _redirect_uri(request_origin)
    async with httpx.AsyncClient(timeout=HF_OAUTH_TIMEOUT_SECONDS) as client:
        try:
            token_resp = await client.post(
                f"{settings.openid_provider_url}{_TOKEN_PATH}",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    # PKCE: prove we're the browser that started login
                    "code_verifier": code_verifier,
                },
                auth=(settings.oauth_client_id or "", settings.oauth_client_secret or ""),
                headers={"Accept": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise AuthError(f"Could not reach HF /oauth/token: {exc}") from None
        if token_resp.status_code >= 400:
            raise AuthError(
                f"HF rejected the code: HTTP {token_resp.status_code} {token_resp.text[:200]}"
            )
        try:
            token_data = token_resp.json()
        except ValueError:
            raise AuthError("HF /oauth/token returned non-JSON.") from None
        access_token = token_data.get("access_token")
        if not access_token or not isinstance(access_token, str):
            raise AuthError("HF /oauth/token missing access_token.")

        try:
            user_resp = await client.get(
                f"{settings.openid_provider_url}{_USERINFO_PATH}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.HTTPError as exc:
            raise AuthError(f"Could not reach HF /oauth/userinfo: {exc}") from None
    if user_resp.status_code >= 400:
        raise AuthError(
            f"HF /oauth/userinfo failed: HTTP {user_resp.status_code}"
        )
    try:
        info: dict[str, Any] = user_resp.json()
    except ValueError:
        raise AuthError("HF /oauth/userinfo returned non-JSON.") from None

    sub = info.get("sub")
    username = info.get("preferred_username") or info.get("name")
    avatar_url = info.get("picture")
    if not isinstance(sub, str) or not sub:
        raise AuthError("HF /oauth/userinfo missing sub.")
    if not isinstance(username, str) or not _HF_USERNAME_RE.match(username):
        raise AuthError(
            "HF /oauth/userinfo returned an unexpected username format."
        )
    if avatar_url is not None and not isinstance(avatar_url, str):
        avatar_url = None

    return SessionUser(
        sub=sub,
        username=username,
        avatar_url=avatar_url,
        expires_at=int(time.time()) + SESSION_MAX_AGE_SECONDS,
    )


# ---- user_id derivation -----------------------------------------------

def hf_user_id(username: str) -> str:
    """Namespace key for a logged-in user. Used as a directory name in
    /tmp/quda_plugins/<id>/ and the plugin path inside the HF dataset.

    The hf_ prefix prevents collision with anon UUIDs (anon_*)."""
    if not _HF_USERNAME_RE.match(username):
        raise ValueError("Invalid HF username for hf_user_id.")
    return f"hf_{username}"


def is_hf_user_id(user_id: str) -> bool:
    """True if this user_id corresponds to an authenticated HF user
    (server-derived from a valid session) rather than an anonymous
    browser UUID. Used to gate features that require persistence."""
    return user_id.startswith("hf_")


def resolve_effective_user_id(
    request: Any,
    query_user_id: str | None,
    *,
    required: bool,
) -> str | None:
    """Single source of truth for figuring out which user_id namespace
    a request operates on.

    Precedence:
      1. Session-derived ``hf_<username>`` from a valid session cookie.
         Always wins so a logged-in user can't spoof someone else's
         namespace by passing a different ``user_id`` query parameter.
      2. ``query_user_id`` (the client-supplied anon UUID). Refused if
         it begins with ``hf_`` — that prefix is reserved for
         authenticated users, and accepting it would let an unauth'd
         client squat on a real HF user's namespace and poison their
         plugin list on next login.

    Behaviour when there is no session and no valid query id:
      * ``required=True``  → raise ``ValueError(reason)`` so the caller
        can return a 400 with that exact reason.
      * ``required=False`` → return ``None`` so the caller can decide
        (e.g. workflow_service treats this as "no plugin lookup").
    """
    # Late import — auth_service is imported all over the place; the
    # session decode bits live below this in the file already.
    cookie = request.cookies.get(SESSION_COOKIE)
    user = decode_session(cookie)
    if user is not None:
        return hf_user_id(user.username)
    if not query_user_id:
        if required:
            raise ValueError(
                "No session cookie and no user_id query parameter."
            )
        return None
    if query_user_id.startswith("hf_"):
        if required:
            raise ValueError(
                "The hf_ user_id prefix is reserved for authenticated "
                "sessions. Sign in with Hugging Face or use a "
                "non-prefixed id."
            )
        return None
    return query_user_id
