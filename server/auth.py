"""認証・トークン関連ユーティリティ。"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import jwt, JWTError

SECRET_KEY = os.environ.get("TALENT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

# bcrypt は最大72バイトしか扱えないため、安全側で切り詰める。
_BCRYPT_MAX = 72


def hash_password(p: str) -> str:
    pw = p.encode("utf-8")[:_BCRYPT_MAX]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    pw = p.encode("utf-8")[:_BCRYPT_MAX]
    try:
        return bcrypt.checkpw(pw, h.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(sub: str, role: str, expires: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": sub, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
