

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import jwt as pyjwt
from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from models import User

JWT_SECRET = os.getenv("JWT_SECRET")

# Roles allowed to access recommendation and DSS endpoints
# Based on backend user model: manager, admin, super_admin
ALLOWED_RECOMMENDATION_ROLES = {"manager", "admin", "super_admin"}



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


def authenticate_recommendation_user(
    db: Session,
    authorization: Optional[str] = Header(default=None),
) -> AuthenticatedUser:
    """Verify the standard platform JWT and return the active user identity.
    
    This authentication is for recommendation and DSS endpoints only.
    Requires manager, admin, or super_admin role.
    """

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
        decoded = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired.") from exc
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token.") from exc

    user_id = decoded.get("id")
    role = decoded.get("role")
    if not user_id or not role:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == int(user_id), User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive.")
    if user.role not in ALLOWED_RECOMMENDATION_ROLES:
        raise HTTPException(
            status_code=403, 
            detail="Access restricted to management roles (manager, admin, super_admin)."
        )

    return AuthenticatedUser(id=user.id, role=user.role)
