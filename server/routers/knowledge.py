"""ナレッジ API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Knowledge, Employee
from ..schemas import KnowledgeOut, KnowledgeShort
from ..deps import current_user

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _snippet(body: str, q: Optional[str], n: int = 120) -> str:
    if not q:
        return body[:n]
    i = body.lower().find(q.lower())
    if i < 0:
        return body[:n]
    s = max(0, i - 40)
    return ("…" if s > 0 else "") + body[s : s + n]


@router.get("", response_model=List[KnowledgeShort])
def search(
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    query = db.query(Knowledge).filter(
        or_(Knowledge.visibility == "all", Knowledge.visibility == user.role)
    )
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            Knowledge.title.like(like),
            Knowledge.body_md.like(like),
            Knowledge.tags.like(like),
        ))
    if category:
        query = query.filter(Knowledge.category == category)
    items = query.order_by(Knowledge.category, Knowledge.title).limit(50).all()
    return [KnowledgeShort(
        id=k.id, category=k.category, title=k.title, tags=k.tags,
        snippet=_snippet(k.body_md, q),
    ) for k in items]


@router.get("/{kid}", response_model=KnowledgeOut)
def get(kid: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    k = db.get(Knowledge, kid)
    if not k:
        raise HTTPException(404, "not found")
    if k.visibility not in ("all", user.role) and user.role != "admin":
        raise HTTPException(403, "forbidden")
    return k
