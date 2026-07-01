"""
Target path: assistant/services/auth.py  (REPLACES existing file)

JWT authentication dependency for assistant routes.

CHANGE IN THIS VERSION
------------------------
The old code had:
    JWT_SECRET = os.getenv("JWT_SECRET", "#2nsnjajn123$$")

If JWT_SECRET were ever unset in the deployment environment (a typo'd
env var name, a missing .env in production, etc.), this service would
silently start up and accept/verify tokens using a hardcoded, public
(now that it's been pasted into a chat) secret. Anyone who knows that
string could forge a valid manager/admin token. This is a real security
hole, not just a style nit.

Now: if JWT_SECRET isn't set, authenticate_assistant_user() raises a clear
500 the first time an authenticated route is actually called, rather than
silently using an insecure default. This is checked per-request (not at
module import time) so a missing secret doesn't crash the entire FastAPI
process -- unauthenticated routes like the health check still work, and
you get a clear error pointing at the actual problem instead of either a
silent security hole or a fully bricked server.

One thing I could NOT verify without your actual JWT issuer (the Node
backend that mints these tokens): this code expects payload fields
`id` and `role`. Given the earlier Sequelize -> Supabase camelCase
migration issues mentioned in your project history, double check the
issuing side actually signs tokens with `id`/`role` and not e.g.
`userId`. If those don't match, every request here returns 401 with
"Invalid token payload" regardless of how valid the token otherwise is.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from models import User

JWT_SECRET = os.getenv("JWT_SECRET")

ALLOWED_ASSISTANT_ROLES = {"manager", "admin", "super_admin"}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: int
    role: str


def get_user_faculty_id(db: Session, user_id: int) -> Optional[int]:
    """Look up faculty_id for a user, for per-faculty data isolation.

    Returns None if the user has no faculty assigned. Callers decide what
    that means for their endpoint: recommendation/briefing GENERATION
    endpoints should treat None as a 403 (a manager must belong to a
    faculty to generate faculty-scoped content); READ endpoints
    (dashboard, risk-ranking, etc.) fall back to an unscoped/global view
    when faculty_id is None, matching the existing behavior of
    /api/manager/recommendations for admin/super_admin roles that aren't
    tied to a single faculty.
    """
    user = db.query(User).filter(User.id == user_id).first()
    return user.faculty_id if user else None


def authenticate_assistant_user(
    db: Session,
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    """Verify the standard platform JWT and return the active user identity."""

    if not JWT_SECRET:
        # Checked here (per-request) rather than at module import time, so a
        # missing JWT_SECRET produces a clear 500 on protected routes instead
        # of crashing the entire FastAPI process -- including unrelated
        # endpoints like the health check that don't need auth at all.
        # This still never falls back to an insecure default secret.
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: JWT_SECRET is not set. Set it to the same "
            "secret your main backend uses to sign tokens.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")

    token = authorization.split(" ", 1)[1]
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token.") from exc

    user_id = decoded.get("id")
    role = decoded.get("role")
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive.")
    if user.role not in ALLOWED_ASSISTANT_ROLES:
        raise HTTPException(status_code=403, detail="Assistant access is restricted to management roles.")

    return AuthenticatedUser(id=user.id, role=user.role)