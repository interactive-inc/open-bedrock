"""ダッシュボード集計 API。"""
from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..models import (
    Employee, Department, Application, ApprovalStep, CareerPosting, Survey, BatchJob,
)
from ..schemas import DashboardOut, BatchJobOut
from ..deps import current_user
from .batch import is_visible_for as _batch_visible_for

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    headcount_total = db.query(func.count(Employee.id)).filter(Employee.status == "active").scalar() or 0

    dept_counts: dict = {}
    rows = (
        db.query(Department.name, func.count(Employee.id))
        .outerjoin(Employee, Employee.dept_id == Department.id)
        .group_by(Department.id, Department.name)
        .all()
    )
    for name, cnt in rows:
        dept_counts[name] = cnt or 0

    app_status: Counter = Counter()
    for r in db.query(Application.status).all():
        app_status[r[0]] += 1

    inbox_count = (
        db.query(func.count(Application.id))
        .join(ApprovalStep, ApprovalStep.application_id == Application.id)
        .filter(
            Application.status == "awaiting_approval",
            ApprovalStep.step_no == Application.current_step,
            ApprovalStep.approver_id == user.id,
            ApprovalStep.status == "pending",
        )
        .scalar()
    ) or 0

    my_pending = (
        db.query(func.count(Application.id))
        .filter(
            Application.applicant_id == user.id,
            Application.status == "awaiting_approval",
        )
        .scalar()
    ) or 0

    open_postings = db.query(func.count(CareerPosting.id)).filter(CareerPosting.status == "open").scalar() or 0
    open_surveys = db.query(func.count(Survey.id)).filter(Survey.status == "open").scalar() or 0

    # ロールごとに閲覧可能なバッチジョブのみ
    all_recent = db.query(BatchJob).order_by(BatchJob.started_at.desc()).limit(50).all()
    recent = [b for b in all_recent if _batch_visible_for(b.audience, user.role)][:5]

    return DashboardOut(
        headcount_total=headcount_total,
        headcount_by_dept=dept_counts,
        applications_by_status=dict(app_status),
        open_inbox_count_for_me=inbox_count,
        my_pending_applications=my_pending,
        open_career_postings=open_postings,
        open_surveys=open_surveys,
        recent_batch_jobs=[
            BatchJobOut(
                id=b.id, name=b.name, status=b.status, started_at=b.started_at,
                finished_at=b.finished_at, message=b.message,
            ) for b in recent
        ],
    )
