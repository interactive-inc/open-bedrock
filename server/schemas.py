"""Pydantic スキーマ。"""
from __future__ import annotations

import warnings
from datetime import datetime
from typing import Any, Optional, List, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# pydantic が BaseModel の互換メソッド `schema` と field 名 `schema_json` の
# 衝突を毎回 UserWarning として出すので抑制する。
warnings.filterwarnings(
    "ignore",
    message=r'Field name "schema_json".*shadows.*',
    category=UserWarning,
)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class EmployeeOut(BaseModel):
    id: int
    code: str
    name: str
    kana: Optional[str] = None
    email: EmailStr
    dept_id: Optional[int] = None
    dept_name: Optional[str] = None
    position: Optional[str] = None
    manager_id: Optional[int] = None
    status: str
    role: str

    class Config:
        from_attributes = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    kana: Optional[str] = None
    dept_id: Optional[int] = None
    position: Optional[str] = None
    manager_id: Optional[int] = None
    status: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    parent_id: Optional[int] = None

    class Config:
        from_attributes = True


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    code: str
    name: str
    category: str
    description: Optional[str] = None
    schema_json: dict
    route_json: list
    active: bool


class ApprovalStepOut(BaseModel):
    step_no: int
    approver_id: int
    approver_name: Optional[str] = None
    status: str
    comment: Optional[str] = None
    acted_at: Optional[datetime] = None


class ApplicationOut(BaseModel):
    id: int
    template_code: str
    template_name: str
    applicant_id: int
    applicant_name: str
    status: str
    current_step: int
    payload_json: dict
    created_at: datetime
    updated_at: datetime
    steps: List[ApprovalStepOut] = []


class ApplicationSubmit(BaseModel):
    template_code: str
    payload: dict[str, Any]


class ApplicationAction(BaseModel):
    comment: Optional[str] = None


class KnowledgeOut(BaseModel):
    id: int
    category: str
    title: str
    body_md: str
    tags: Optional[str] = None
    visibility: str
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeShort(BaseModel):
    id: int
    category: str
    title: str
    tags: Optional[str] = None
    snippet: Optional[str] = None


class RoomOut(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    capacity: int

    class Config:
        from_attributes = True


class RoomAvailability(BaseModel):
    room: RoomOut
    available: bool
    conflicts: List[dict] = Field(default_factory=list)


class RoomReservationCreate(BaseModel):
    room_id: int
    start_at: datetime
    end_at: datetime
    purpose: Optional[str] = None


class RoomReservationOut(BaseModel):
    id: int
    room_id: int
    room_name: str
    user_id: int
    user_name: str
    start_at: datetime
    end_at: datetime
    purpose: Optional[str] = None


# ============================================================
# タレントパレット相当の追加モジュール
# ============================================================


class SkillOut(BaseModel):
    id: int
    code: str
    name: str
    category: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SkillCreate(BaseModel):
    code: str
    name: str
    category: str
    description: Optional[str] = None


class EmployeeSkillOut(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    skill_id: int
    skill_code: Optional[str] = None
    skill_name: Optional[str] = None
    skill_category: Optional[str] = None
    level: int
    years: Optional[float] = None
    note: Optional[str] = None


class EmployeeSkillUpsert(BaseModel):
    skill_code: str
    level: int = Field(ge=1, le=5)
    years: Optional[float] = None
    note: Optional[str] = None


class GoalOut(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    period: str
    title: str
    description: Optional[str] = None
    kpi: Optional[str] = None
    weight: int
    status: str
    created_at: datetime
    updated_at: datetime


class GoalCreate(BaseModel):
    period: str
    title: str
    description: Optional[str] = None
    kpi: Optional[str] = None
    weight: int = 10
    status: str = "draft"


class EvaluationOut(BaseModel):
    id: int
    goal_id: int
    kind: str
    score: Optional[int] = None
    comment: Optional[str] = None
    evaluator_id: Optional[int] = None
    evaluator_name: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime


class EvaluationCreate(BaseModel):
    kind: Literal["self", "manager", "final"]
    score: Optional[int] = Field(default=None, ge=0, le=100)
    comment: Optional[str] = None


class OneOnOneOut(BaseModel):
    id: int
    member_id: int
    member_name: Optional[str] = None
    manager_id: int
    manager_name: Optional[str] = None
    held_at: datetime
    topics: Optional[str] = None
    member_note: Optional[str] = None
    manager_note: Optional[str] = None
    next_action: Optional[str] = None


class OneOnOneCreate(BaseModel):
    member_email: EmailStr
    held_at: Optional[datetime] = None
    topics: Optional[str] = None
    member_note: Optional[str] = None
    manager_note: Optional[str] = None
    next_action: Optional[str] = None


class SurveyOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    questions_json: list
    status: str
    target_role: Optional[str] = None
    created_at: datetime


class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    questions_json: list
    target_role: Optional[str] = None


class SurveyResponseIn(BaseModel):
    answers_json: dict


class SurveyResponseOut(BaseModel):
    id: int
    survey_id: int
    respondent_id: int
    respondent_name: Optional[str] = None
    answers_json: dict
    submitted_at: datetime


class CareerSheetOut(BaseModel):
    employee_id: int
    history: Optional[str] = None
    strengths: Optional[str] = None
    aspirations: Optional[str] = None
    self_pr: Optional[str] = None
    updated_at: Optional[datetime] = None


class CareerSheetUpsert(BaseModel):
    history: Optional[str] = None
    strengths: Optional[str] = None
    aspirations: Optional[str] = None
    self_pr: Optional[str] = None


class CareerPostingOut(BaseModel):
    id: int
    title: str
    dept_id: Optional[int] = None
    dept_name: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    status: str
    posted_by: Optional[int] = None
    deadline: Optional[datetime] = None
    created_at: datetime


class CareerPostingCreate(BaseModel):
    title: str
    dept_id: Optional[int] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    deadline: Optional[datetime] = None


class CareerApplyIn(BaseModel):
    message: Optional[str] = None


class CareerApplicationOut(BaseModel):
    id: int
    posting_id: int
    posting_title: Optional[str] = None
    applicant_id: int
    applicant_name: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: datetime


class BatchJobOut(BaseModel):
    id: int
    name: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    message: Optional[str] = None


class DashboardOut(BaseModel):
    headcount_total: int
    headcount_by_dept: dict
    applications_by_status: dict
    open_inbox_count_for_me: int
    # 自分が申請者として出した、承認待ち中の件数
    my_pending_applications: int = 0
    open_career_postings: int
    open_surveys: int
    recent_batch_jobs: List[BatchJobOut]
