"""MBO 目標・評価 API。"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Goal, Evaluation, Employee
from ..schemas import GoalOut, GoalCreate, EvaluationOut, EvaluationCreate
from ..deps import current_user

router = APIRouter(prefix="/goals", tags=["goals"])


def _g(g: Goal) -> GoalOut:
    return GoalOut(
        id=g.id, employee_id=g.employee_id,
        employee_name=g.employee.name if g.employee else None,
        period=g.period, title=g.title, description=g.description,
        kpi=g.kpi, weight=g.weight, status=g.status,
        created_at=g.created_at, updated_at=g.updated_at,
    )


def _e(e: Evaluation) -> EvaluationOut:
    return EvaluationOut(
        id=e.id, goal_id=e.goal_id, kind=e.kind,
        score=e.score, comment=e.comment,
        evaluator_id=e.evaluator_id,
        evaluator_name=e.evaluator.name if e.evaluator else None,
        finalized_at=e.finalized_at, created_at=e.created_at,
    )


@router.get("", response_model=List[GoalOut])
def list_goals(
    employee_id: Optional[int] = None,
    period: Optional[str] = None,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    q = db.query(Goal)
    if employee_id is None:
        # 既定は自分。マネージャー/HR/admin は他人も指定可
        q = q.filter(Goal.employee_id == user.id)
    else:
        if employee_id != user.id and user.role not in ("manager", "hr", "admin"):
            raise HTTPException(403, "forbidden")
        q = q.filter(Goal.employee_id == employee_id)
    if period:
        q = q.filter(Goal.period == period)
    return [_g(x) for x in q.order_by(Goal.period.desc(), Goal.id).all()]


@router.post("", response_model=GoalOut)
def create_goal(body: GoalCreate, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    g = Goal(employee_id=user.id, **body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return _g(g)


@router.get("/{gid}", response_model=GoalOut)
def get_goal(gid: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    g = db.get(Goal, gid)
    if not g:
        raise HTTPException(404, "not found")
    if g.employee_id != user.id and user.role not in ("manager", "hr", "admin"):
        raise HTTPException(403, "forbidden")
    return _g(g)


@router.patch("/{gid}", response_model=GoalOut)
def update_goal(gid: int, body: GoalCreate, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    g = db.get(Goal, gid)
    if not g:
        raise HTTPException(404, "not found")
    if g.employee_id != user.id and user.role not in ("manager", "hr", "admin"):
        raise HTTPException(403, "forbidden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return _g(g)


@router.post("/{gid}/evaluations", response_model=EvaluationOut)
def add_evaluation(
    gid: int, body: EvaluationCreate,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    g = db.get(Goal, gid)
    if not g:
        raise HTTPException(404, "goal not found")
    if body.kind == "self" and g.employee_id != user.id:
        raise HTTPException(403, "self評価は本人のみ可能")
    if body.kind in ("manager", "final") and user.role not in ("manager", "hr", "admin"):
        raise HTTPException(403, "管理者権限が必要です")
    e = Evaluation(goal_id=gid, kind=body.kind, score=body.score,
                   comment=body.comment, evaluator_id=user.id,
                   finalized_at=datetime.utcnow() if body.kind == "final" else None)
    db.add(e)
    if body.kind == "final":
        g.status = "done"
    db.commit()
    db.refresh(e)
    return _e(e)


@router.get("/{gid}/evaluations", response_model=List[EvaluationOut])
def list_evaluations(gid: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    g = db.get(Goal, gid)
    if not g:
        raise HTTPException(404, "not found")
    if g.employee_id != user.id and user.role not in ("manager", "hr", "admin"):
        raise HTTPException(403, "forbidden")
    rows = db.query(Evaluation).filter(Evaluation.goal_id == gid).order_by(Evaluation.created_at).all()
    return [_e(x) for x in rows]
