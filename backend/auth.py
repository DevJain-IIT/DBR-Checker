"""
auth.py

Admin authentication: bcrypt password hashing + signed (JWT) session tokens.

- First admin is auto-seeded on startup from ADMIN_EMAIL + ADMIN_PASSCODE
  (the env vars already set on Render) IF the admins table is empty.
- Admins log in with email+password -> receive a token the browser stores and
  sends as `Authorization: Bearer <token>` on admin endpoints.
- Logged-in admins can add/remove other admins and change passwords.

ADMIN_JWT_SECRET signs the tokens; falls back to a dev secret if unset (set it
in prod). Tokens last ADMIN_TOKEN_HOURS (default 12h).
"""
from __future__ import annotations

import datetime as dt
import os

import bcrypt
import jwt
from sqlalchemy.orm import Session

from db import Admin

JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "dev-insecure-change-me")
JWT_ALG = "HS256"
TOKEN_HOURS = int(os.getenv("ADMIN_TOKEN_HOURS", "12"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def make_token(admin: Admin) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": admin.id,
        "email": admin.email,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(hours=TOKEN_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


def seed_first_admin(db: Session) -> None:
    """If no admins exist, create one from env so you can log in initially."""
    if db.query(Admin).count() > 0:
        return
    email = os.getenv("ADMIN_EMAIL", "aiplanner04@gmail.com").strip().lower()
    password = os.getenv("ADMIN_PASSCODE", "admin")
    db.add(Admin(email=email, password_hash=hash_password(password)))
    db.commit()
