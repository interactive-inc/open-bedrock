"""FastAPI 依存性（認証ユーザの取り出しなど）。"""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee
from .auth import decode_token

security = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Employee:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    data = decode_token(creds.credentials)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(Employee).filter(Employee.email == data.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    def _inner(user: Employee = Depends(current_user)) -> Employee:
        if user.role not in roles and "admin" != user.role:
            raise HTTPException(status_code=403, detail=f"Requires one of {roles}")
        return user
    return _inner
