"""バッチ状況 API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import BatchJob, Employee
from ..schemas import BatchJobOut
from ..deps import current_user

router = APIRouter(prefix="/batch", tags=["batch"])


def is_visible_for(audience: Optional[str], role: str) -> bool:
    """audience（カンマ区切りロール文字列）に role が含まれていれば可視。"all" は全員可視。"""
    if not audience or audience == "all":
        return True
    return role in {x.strip() for x in audience.split(",") if x.strip()}


@router.get("", response_model=List[BatchJobOut])
def list_batch_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    q = db.query(BatchJob)
    if status:
        q = q.filter(BatchJob.status == status)
    rows = q.order_by(BatchJob.started_at.desc()).all()
    rows = [r for r in rows if is_visible_for(r.audience, user.role)][:limit]
    return [
        BatchJobOut(
            id=r.id, name=r.name, status=r.status,
            started_at=r.started_at, finished_at=r.finished_at, message=r.message,
        ) for r in rows
    ]
