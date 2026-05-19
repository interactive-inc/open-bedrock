"""1on1 API。"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import OneOnOne, Employee
from ..schemas import OneOnOneOut, OneOnOneCreate
from ..deps import current_user

router = APIRouter(prefix="/oneonone", tags=["oneonone"])


def _o(r: OneOnOne) -> OneOnOneOut:
    return OneOnOneOut(
        id=r.id, member_id=r.member_id,
        member_name=r.member.name if r.member else None,
        manager_id=r.manager_id,
        manager_name=r.manager.name if r.manager else None,
        held_at=r.held_at, topics=r.topics,
        member_note=r.member_note, manager_note=r.manager_note,
        next_action=r.next_action,
    )


@router.get("", response_model=List[OneOnOneOut])
def list_oneonone(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    """自分が member または manager のものを取得。"""
    q = db.query(OneOnOne)
    if employee_id is None:
        q = q.filter(or_(OneOnOne.member_id == user.id, OneOnOne.manager_id == user.id))
    else:
        if employee_id != user.id and user.role not in ("manager", "hr", "admin"):
            raise HTTPException(403, "forbidden")
        q = q.filter(or_(OneOnOne.member_id == employee_id, OneOnOne.manager_id == employee_id))
    return [_o(x) for x in q.order_by(OneOnOne.held_at.desc()).limit(200).all()]


@router.post("", response_model=OneOnOneOut)
def create_oneonone(body: OneOnOneCreate, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    """マネージャー（または上長/HR/admin）がメンバ宛の1on1記録を作成。"""
    if user.role not in ("manager", "hr", "admin"):
        raise HTTPException(403, "マネージャー権限が必要です")
    member = db.query(Employee).filter(Employee.email == body.member_email).first()
    if not member:
        raise HTTPException(404, "member not found")
    o = OneOnOne(
        member_id=member.id, manager_id=user.id,
        held_at=body.held_at or datetime.utcnow(),
        topics=body.topics, member_note=body.member_note,
        manager_note=body.manager_note, next_action=body.next_action,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return _o(o)


@router.get("/{oid}", response_model=OneOnOneOut)
def get_oneonone(oid: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    r = db.get(OneOnOne, oid)
    if not r:
        raise HTTPException(404, "not found")
    if user.id not in (r.member_id, r.manager_id) and user.role not in ("hr", "admin"):
        raise HTTPException(403, "forbidden")
    return _o(r)
