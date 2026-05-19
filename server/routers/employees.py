"""社員 API。"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Employee, Department
from ..schemas import EmployeeOut, EmployeeUpdate
from ..deps import current_user, require_role

router = APIRouter(prefix="/employees", tags=["employees"])


def _out(u: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=u.id, code=u.code, name=u.name, kana=u.kana, email=u.email,
        dept_id=u.dept_id, dept_name=u.department.name if u.department else None,
        position=u.position, manager_id=u.manager_id, status=u.status, role=u.role,
    )


@router.get("", response_model=List[EmployeeOut])
def list_employees(
    q: Optional[str] = None,
    dept: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    query = db.query(Employee)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            Employee.name.like(like), Employee.kana.like(like),
            Employee.email.like(like), Employee.code.like(like),
        ))
    if dept:
        d = db.query(Department).filter(or_(Department.code == dept, Department.name == dept)).first()
        if d:
            query = query.filter(Employee.dept_id == d.id)
        else:
            return []
    if status:
        query = query.filter(Employee.status == status)
    return [_out(u) for u in query.order_by(Employee.code).limit(100).all()]


@router.get("/{emp_id}", response_model=EmployeeOut)
def get_employee(emp_id: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    u = db.get(Employee, emp_id)
    if not u:
        raise HTTPException(404, "not found")
    return _out(u)


@router.patch("/{emp_id}", response_model=EmployeeOut)
def update_employee(
    emp_id: int,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_role("hr", "admin")),
):
    u = db.get(Employee, emp_id)
    if not u:
        raise HTTPException(404, "not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    return _out(u)
