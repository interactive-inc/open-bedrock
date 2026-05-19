"""スキル API。"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import Skill, EmployeeSkill, Employee
from ..schemas import SkillOut, SkillCreate, EmployeeSkillOut, EmployeeSkillUpsert
from ..deps import current_user, require_role

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=List[SkillOut])
def list_skills(
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    qry = db.query(Skill)
    if q:
        like = f"%{q}%"
        qry = qry.filter(or_(Skill.name.like(like), Skill.code.like(like)))
    if category:
        qry = qry.filter(Skill.category == category)
    return qry.order_by(Skill.category, Skill.code).all()


@router.post("", response_model=SkillOut)
def create_skill(
    body: SkillCreate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_role("hr", "admin")),
):
    if db.query(Skill).filter(Skill.code == body.code).first():
        raise HTTPException(409, "skill code already exists")
    s = Skill(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _to_es_out(es: EmployeeSkill) -> EmployeeSkillOut:
    return EmployeeSkillOut(
        id=es.id, employee_id=es.employee_id,
        employee_name=es.employee.name if es.employee else None,
        skill_id=es.skill_id,
        skill_code=es.skill.code if es.skill else None,
        skill_name=es.skill.name if es.skill else None,
        skill_category=es.skill.category if es.skill else None,
        level=es.level, years=es.years, note=es.note,
    )


@router.get("/me", response_model=List[EmployeeSkillOut])
def list_my_skills(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    rows = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == user.id).all()
    return [_to_es_out(es) for es in rows]


@router.put("/me", response_model=EmployeeSkillOut)
def upsert_my_skill(
    body: EmployeeSkillUpsert,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    skill = db.query(Skill).filter(Skill.code == body.skill_code).first()
    if not skill:
        raise HTTPException(404, "skill not found")
    es = (
        db.query(EmployeeSkill)
        .filter(EmployeeSkill.employee_id == user.id, EmployeeSkill.skill_id == skill.id)
        .first()
    )
    if not es:
        es = EmployeeSkill(employee_id=user.id, skill_id=skill.id, level=body.level,
                           years=body.years, note=body.note)
        db.add(es)
    else:
        es.level = body.level
        es.years = body.years
        es.note = body.note
    db.commit()
    db.refresh(es)
    return _to_es_out(es)


@router.get("/employees/{emp_id}", response_model=List[EmployeeSkillOut])
def list_employee_skills(
    emp_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    rows = db.query(EmployeeSkill).filter(EmployeeSkill.employee_id == emp_id).all()
    return [_to_es_out(es) for es in rows]
