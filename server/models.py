"""ORM モデル定義。"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Text, ForeignKey, DateTime, JSON, Boolean, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.utcnow()


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)

    employees: Mapped[List["Employee"]] = relationship(
        "Employee", back_populates="department", foreign_keys="Employee.dept_id"
    )


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    kana: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    dept_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    manager_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/leave/retired
    hired_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # member/manager/hr/admin
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    department: Mapped[Optional[Department]] = relationship(
        "Department", back_populates="employees", foreign_keys=[dept_id]
    )
    manager: Mapped[Optional["Employee"]] = relationship(
        "Employee", remote_side="Employee.id", foreign_keys=[manager_id]
    )


class ApplicationTemplate(Base):
    __tablename__ = "application_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # APP-001
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schema_json: Mapped[dict] = mapped_column(JSON)   # JSON Schema for payload
    route_json: Mapped[list] = mapped_column(JSON)    # [{step, approver: "manager_of_applicant"|"role:hr"|"user:42"}]
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("application_templates.id"))
    applicant_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    status: Mapped[str] = mapped_column(String(24), default="awaiting_approval")
    # awaiting_approval / approved / rejected / withdrawn
    payload_json: Mapped[dict] = mapped_column(JSON)
    current_step: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    template: Mapped[ApplicationTemplate] = relationship("ApplicationTemplate")
    applicant: Mapped[Employee] = relationship("Employee", foreign_keys=[applicant_id])
    steps: Mapped[List["ApprovalStep"]] = relationship(
        "ApprovalStep", back_populates="application",
        order_by="ApprovalStep.step_no", cascade="all,delete-orphan"
    )


class ApprovalStep(Base):
    __tablename__ = "approval_steps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    step_no: Mapped[int] = mapped_column(Integer)
    approver_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/approved/rejected/skipped
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    application: Mapped[Application] = relationship("Application", back_populates="steps")
    approver: Mapped[Employee] = relationship("Employee", foreign_keys=[approver_id])


class Knowledge(Base):
    __tablename__ = "knowledge"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(256))
    body_md: Mapped[str] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)  # comma sep
    visibility: Mapped[str] = mapped_column(String(16), default="all")  # all/hr/admin
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    location: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=4)


class RoomReservation(Base):
    __tablename__ = "room_reservations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    purpose: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    room: Mapped[Room] = relationship("Room")
    user: Mapped[Employee] = relationship("Employee")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64))
    target: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=now)


# ============================================================
# タレントパレット相当の追加モジュール
# ============================================================


class Skill(Base):
    """スキルマスタ（カタログ）。"""
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64))  # 言語/フレームワーク/ビジネス/資格 等
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class EmployeeSkill(Base):
    """社員が保有するスキルとレベル。"""
    __tablename__ = "employee_skills"
    __table_args__ = (UniqueConstraint("employee_id", "skill_id", name="uq_emp_skill"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    level: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    years: Mapped[Optional[float]] = mapped_column(default=None)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    employee: Mapped["Employee"] = relationship("Employee")
    skill: Mapped["Skill"] = relationship("Skill")


class Goal(Base):
    """MBO 目標。"""
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    period: Mapped[str] = mapped_column(String(16))  # 例 "2026H1"
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kpi: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    weight: Mapped[int] = mapped_column(Integer, default=10)  # 重み(合計100想定)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft/active/done
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    employee: Mapped["Employee"] = relationship("Employee")
    evaluations: Mapped[List["Evaluation"]] = relationship(
        "Evaluation", back_populates="goal", cascade="all,delete-orphan"
    )


class Evaluation(Base):
    """評価（自己/上長/最終）。"""
    __tablename__ = "evaluations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id"))
    kind: Mapped[str] = mapped_column(String(16))  # self/manager/final
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-100
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    goal: Mapped["Goal"] = relationship("Goal", back_populates="evaluations")
    evaluator: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[evaluator_id])


class OneOnOne(Base):
    """1on1シート。"""
    __tablename__ = "one_on_ones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    manager_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    held_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    topics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    member_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manager_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    member: Mapped["Employee"] = relationship("Employee", foreign_keys=[member_id])
    manager: Mapped["Employee"] = relationship("Employee", foreign_keys=[manager_id])


class Survey(Base):
    """アンケート。"""
    __tablename__ = "surveys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    questions_json: Mapped[list] = mapped_column(JSON)
    # 例: [{"id":"q1","type":"single","title":"満足度","choices":["低","中","高"]},
    #       {"id":"q2","type":"text","title":"自由記述"}]
    status: Mapped[str] = mapped_column(String(16), default="open")  # open/closed
    target_role: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("survey_id", "respondent_id", name="uq_survey_resp"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("surveys.id"))
    respondent_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    answers_json: Mapped[dict] = mapped_column(JSON)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CareerSheet(Base):
    """キャリアシート（社員ごとに1件）。"""
    __tablename__ = "career_sheets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), unique=True)
    history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)         # 経歴
    strengths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # 強み
    aspirations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)     # 志向・希望
    self_pr: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    employee: Mapped["Employee"] = relationship("Employee")


class CareerPosting(Base):
    """キャリアボード（社内公募）。"""
    __tablename__ = "career_postings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    dept_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required_skills: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)  # comma sep
    status: Mapped[str] = mapped_column(String(16), default="open")
    posted_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CareerApplication(Base):
    """キャリアボードへの応募。"""
    __tablename__ = "career_applications"
    __table_args__ = (UniqueConstraint("posting_id", "applicant_id", name="uq_career_app"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    posting_id: Mapped[int] = mapped_column(ForeignKey("career_postings.id"))
    applicant_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="submitted")  # submitted/accepted/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class BatchJob(Base):
    """バッチ実行履歴（バッチ状況画面の元データ）。"""
    __tablename__ = "batch_jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default="success")  # running/success/failed
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    triggered_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    # 閲覧可能ロールのカンマ区切り。"all" は全ロール可視。
    audience: Mapped[str] = mapped_column(String(64), default="admin,hr")
