"""認証エンドポイント。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Employee
from ..schemas import LoginRequest, Token, EmployeeOut
from ..auth import verify_password, create_access_token
from ..deps import current_user

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Employee).filter(Employee.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = create_access_token(sub=user.email, role=user.role)
    return Token(access_token=token)


@router.get("/me", response_model=EmployeeOut)
def me(user: Employee = Depends(current_user)):
    return _to_employee_out(user)


def _to_employee_out(u: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=u.id, code=u.code, name=u.name, kana=u.kana, email=u.email,
        dept_id=u.dept_id, dept_name=u.department.name if u.department else None,
        position=u.position, manager_id=u.manager_id, status=u.status, role=u.role,
    )
