"""キャリアシート + キャリアボード(β) API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CareerSheet, CareerPosting, CareerApplication, Department, Employee
from ..schemas import (
    CareerSheetOut, CareerSheetUpsert,
    CareerPostingOut, CareerPostingCreate,
    CareerApplyIn, CareerApplicationOut,
)
from ..deps import current_user, require_role

router = APIRouter(prefix="/career", tags=["career"])


# ---------- キャリアシート ----------
@router.get("/sheet/me", response_model=CareerSheetOut)
def my_sheet(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    s = db.query(CareerSheet).filter(CareerSheet.employee_id == user.id).first()
    if not s:
        return CareerSheetOut(employee_id=user.id)
    return CareerSheetOut(
        employee_id=s.employee_id, history=s.history, strengths=s.strengths,
        aspirations=s.aspirations, self_pr=s.self_pr, updated_at=s.updated_at,
    )


@router.put("/sheet/me", response_model=CareerSheetOut)
def upsert_my_sheet(body: CareerSheetUpsert, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    s = db.query(CareerSheet).filter(CareerSheet.employee_id == user.id).first()
    if not s:
        s = CareerSheet(employee_id=user.id, **body.model_dump())
        db.add(s)
    else:
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return CareerSheetOut(
        employee_id=s.employee_id, history=s.history, strengths=s.strengths,
        aspirations=s.aspirations, self_pr=s.self_pr, updated_at=s.updated_at,
    )


# ---------- キャリアボード(β) ----------
def _p(p: CareerPosting, db: Session) -> CareerPostingOut:
    dept_name = None
    if p.dept_id:
        d = db.get(Department, p.dept_id)
        dept_name = d.name if d else None
    return CareerPostingOut(
        id=p.id, title=p.title, dept_id=p.dept_id, dept_name=dept_name,
        description=p.description, required_skills=p.required_skills,
        status=p.status, posted_by=p.posted_by,
        deadline=p.deadline, created_at=p.created_at,
    )


@router.get("/postings", response_model=List[CareerPostingOut])
def list_postings(
    status: Optional[str] = "open",
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    q = db.query(CareerPosting)
    if status:
        q = q.filter(CareerPosting.status == status)
    return [_p(x, db) for x in q.order_by(CareerPosting.created_at.desc()).all()]


@router.post("/postings", response_model=CareerPostingOut)
def create_posting(
    body: CareerPostingCreate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_role("hr", "admin", "manager")),
):
    p = CareerPosting(posted_by=user.id, **body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _p(p, db)


@router.post("/postings/{pid}/apply", response_model=CareerApplicationOut)
def apply_posting(
    pid: int, body: CareerApplyIn,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    p = db.get(CareerPosting, pid)
    if not p or p.status != "open":
        raise HTTPException(404, "posting not available")
    if (
        db.query(CareerApplication)
        .filter(CareerApplication.posting_id == pid, CareerApplication.applicant_id == user.id)
        .first()
    ):
        raise HTTPException(409, "already applied")
    a = CareerApplication(posting_id=pid, applicant_id=user.id, message=body.message)
    db.add(a)
    db.commit()
    db.refresh(a)
    return CareerApplicationOut(
        id=a.id, posting_id=a.posting_id, posting_title=p.title,
        applicant_id=a.applicant_id, applicant_name=user.name,
        message=a.message, status=a.status, created_at=a.created_at,
    )


@router.get("/applications/mine", response_model=List[CareerApplicationOut])
def my_applications(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    rows = db.query(CareerApplication).filter(CareerApplication.applicant_id == user.id).all()
    out: List[CareerApplicationOut] = []
    for a in rows:
        p = db.get(CareerPosting, a.posting_id)
        out.append(CareerApplicationOut(
            id=a.id, posting_id=a.posting_id, posting_title=p.title if p else None,
            applicant_id=a.applicant_id, applicant_name=user.name,
            message=a.message, status=a.status, created_at=a.created_at,
        ))
    return out
