"""組織 API。"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Department, Employee
from ..schemas import DepartmentOut
from ..deps import current_user

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    return db.query(Department).order_by(Department.code).all()
