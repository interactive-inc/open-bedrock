"""アンケート API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter

from ..db import get_db
from ..models import Survey, SurveyResponse, Employee
from ..schemas import (
    SurveyOut, SurveyCreate, SurveyResponseIn, SurveyResponseOut,
)
from ..deps import current_user, require_role

router = APIRouter(prefix="/surveys", tags=["surveys"])


def _s(s: Survey) -> SurveyOut:
    return SurveyOut(
        id=s.id, title=s.title, description=s.description,
        questions_json=s.questions_json, status=s.status,
        target_role=s.target_role, created_at=s.created_at,
    )


@router.get("", response_model=List[SurveyOut])
def list_surveys(
    status: Optional[str] = "open",
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    q = db.query(Survey)
    if status:
        q = q.filter(Survey.status == status)
    return [_s(x) for x in q.order_by(Survey.created_at.desc()).all()]


@router.post("", response_model=SurveyOut)
def create_survey(
    body: SurveyCreate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_role("hr", "admin")),
):
    s = Survey(
        title=body.title, description=body.description,
        questions_json=body.questions_json, target_role=body.target_role,
        created_by=user.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _s(s)


@router.get("/{sid}", response_model=SurveyOut)
def get_survey(sid: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    s = db.get(Survey, sid)
    if not s:
        raise HTTPException(404, "not found")
    return _s(s)


@router.post("/{sid}/responses", response_model=SurveyResponseOut)
def submit_response(
    sid: int, body: SurveyResponseIn,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    s = db.get(Survey, sid)
    if not s:
        raise HTTPException(404, "survey not found")
    if s.status != "open":
        raise HTTPException(400, "survey is not open")
    if (
        db.query(SurveyResponse)
        .filter(SurveyResponse.survey_id == sid, SurveyResponse.respondent_id == user.id)
        .first()
    ):
        raise HTTPException(409, "already submitted")
    r = SurveyResponse(survey_id=sid, respondent_id=user.id, answers_json=body.answers_json)
    db.add(r)
    db.commit()
    db.refresh(r)
    return SurveyResponseOut(
        id=r.id, survey_id=r.survey_id,
        respondent_id=r.respondent_id, respondent_name=user.name,
        answers_json=r.answers_json, submitted_at=r.submitted_at,
    )


@router.get("/{sid}/summary")
def summary(
    sid: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_role("hr", "admin")),
):
    s = db.get(Survey, sid)
    if not s:
        raise HTTPException(404, "not found")
    responses = db.query(SurveyResponse).filter(SurveyResponse.survey_id == sid).all()
    out: dict = {"survey_id": sid, "title": s.title, "response_count": len(responses), "questions": []}
    for q in s.questions_json:
        qid = q["id"]
        if q["type"] == "single":
            counter: Counter = Counter()
            for r in responses:
                ans = r.answers_json.get(qid)
                if ans is not None:
                    counter[ans] += 1
            out["questions"].append({
                "id": qid, "title": q["title"], "type": "single",
                "distribution": dict(counter),
            })
        elif q["type"] == "text":
            out["questions"].append({
                "id": qid, "title": q["title"], "type": "text",
                "answers": [r.answers_json.get(qid) for r in responses if r.answers_json.get(qid)],
            })
    return out
