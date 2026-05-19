"""申請テンプレート API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ApplicationTemplate, Employee
from ..schemas import TemplateOut
from ..deps import current_user

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=List[TemplateOut])
def list_templates(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    q = db.query(ApplicationTemplate).filter(ApplicationTemplate.active == True)
    if category:
        q = q.filter(ApplicationTemplate.category == category)
    return q.order_by(ApplicationTemplate.code).all()


@router.get("/{code}", response_model=TemplateOut)
def get_template(code: str, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    t = db.query(ApplicationTemplate).filter(ApplicationTemplate.code == code).first()
    if not t:
        raise HTTPException(404, "template not found")
    return t
