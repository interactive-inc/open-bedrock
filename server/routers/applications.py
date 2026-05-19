"""申請ワークフロー API。

- 申請テンプレートの schema_json で payload を簡易バリデート（required と type）
- route_json に従って ApprovalStep を生成
- 承認/却下時に current_step を進める
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    ApplicationTemplate, Application, ApprovalStep, Employee, AuditLog,
)
from ..schemas import (
    ApplicationOut, ApprovalStepOut, ApplicationSubmit, ApplicationAction,
)
from ..deps import current_user

router = APIRouter(prefix="/applications", tags=["applications"])


def _validate_payload(schema: dict, payload: dict) -> None:
    """とても軽量な JSON Schema バリデータ（required と type のみ）。"""
    required = schema.get("required", [])
    for k in required:
        if k not in payload or payload[k] in (None, ""):
            raise HTTPException(422, f"missing field: {k}")
    props = schema.get("properties", {})
    typemap = {"string": str, "integer": int, "number": (int, float), "boolean": bool, "array": list, "object": dict}
    for k, v in payload.items():
        if k in props and "type" in props[k]:
            expected = typemap.get(props[k]["type"])
            if expected and not isinstance(v, expected):
                raise HTTPException(422, f"field {k}: expected {props[k]['type']}")


def _resolve_approver(spec: str, applicant: Employee, db: Session) -> Optional[Employee]:
    if spec == "manager_of_applicant":
        if applicant.manager_id:
            return db.get(Employee, applicant.manager_id)
        return None
    if spec.startswith("role:"):
        role = spec.split(":", 1)[1]
        return db.query(Employee).filter(Employee.role == role).order_by(Employee.id).first()
    if spec.startswith("user:"):
        uid = int(spec.split(":", 1)[1])
        return db.get(Employee, uid)
    return None


def _to_out(app: Application) -> ApplicationOut:
    return ApplicationOut(
        id=app.id,
        template_code=app.template.code,
        template_name=app.template.name,
        applicant_id=app.applicant_id,
        applicant_name=app.applicant.name,
        status=app.status,
        current_step=app.current_step,
        payload_json=app.payload_json,
        created_at=app.created_at,
        updated_at=app.updated_at,
        steps=[
            ApprovalStepOut(
                step_no=s.step_no, approver_id=s.approver_id,
                approver_name=s.approver.name if s.approver else None,
                status=s.status, comment=s.comment, acted_at=s.acted_at,
            ) for s in app.steps
        ],
    )


@router.post("", response_model=ApplicationOut)
def submit(body: ApplicationSubmit, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    tmpl = db.query(ApplicationTemplate).filter(ApplicationTemplate.code == body.template_code).first()
    if not tmpl or not tmpl.active:
        raise HTTPException(404, "template not found or inactive")

    _validate_payload(tmpl.schema_json, body.payload)

    app = Application(
        template_id=tmpl.id, applicant_id=user.id,
        status="awaiting_approval", current_step=1,
        payload_json=body.payload,
    )
    db.add(app)
    db.flush()

    # 承認ステップ生成
    for spec in tmpl.route_json:
        approver = _resolve_approver(spec["approver"], user, db)
        if not approver:
            raise HTTPException(400, f"approver could not be resolved: {spec['approver']}")
        db.add(ApprovalStep(
            application_id=app.id, step_no=spec["step"],
            approver_id=approver.id, status="pending",
        ))

    db.add(AuditLog(actor_id=user.id, action="submit", target=f"application:{app.id}",
                    payload_json={"template": tmpl.code}))
    db.commit()
    db.refresh(app)
    return _to_out(app)


@router.get("", response_model=List[ApplicationOut])
def list_mine(
    status: Optional[str] = None,
    db: Session = Depends(get_db), user: Employee = Depends(current_user),
):
    q = db.query(Application).filter(Application.applicant_id == user.id)
    if status:
        q = q.filter(Application.status == status)
    return [_to_out(a) for a in q.order_by(Application.created_at.desc()).limit(200).all()]


@router.get("/inbox", response_model=List[ApplicationOut])
def inbox(db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    """自分が現在の承認者になっている申請。"""
    q = (
        db.query(Application)
        .join(ApprovalStep, ApprovalStep.application_id == Application.id)
        .filter(
            Application.status == "awaiting_approval",
            ApprovalStep.step_no == Application.current_step,
            ApprovalStep.approver_id == user.id,
            ApprovalStep.status == "pending",
        )
    )
    return [_to_out(a) for a in q.order_by(Application.created_at).limit(200).all()]


@router.get("/{app_id}", response_model=ApplicationOut)
def get_app(app_id: int, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "not found")
    return _to_out(app)


def _act(app_id: int, action: str, comment: Optional[str], db: Session, user: Employee) -> Application:
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "not found")
    if app.status != "awaiting_approval":
        raise HTTPException(400, f"cannot {action} in status {app.status}")

    step = next((s for s in app.steps if s.step_no == app.current_step), None)
    if not step or step.status != "pending":
        raise HTTPException(400, "no pending step")
    if step.approver_id != user.id and user.role != "admin":
        raise HTTPException(403, "you are not the current approver")

    step.status = "approved" if action == "approve" else "rejected"
    step.comment = comment
    step.acted_at = datetime.utcnow()

    if action == "reject":
        app.status = "rejected"
    else:
        # 次のステップへ
        next_step = next((s for s in app.steps if s.step_no == app.current_step + 1), None)
        if next_step:
            app.current_step += 1
        else:
            app.status = "approved"

    db.add(AuditLog(actor_id=user.id, action=action, target=f"application:{app.id}",
                    payload_json={"comment": comment}))
    db.commit()
    db.refresh(app)
    return app


@router.post("/{app_id}/approve", response_model=ApplicationOut)
def approve(app_id: int, body: ApplicationAction, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    return _to_out(_act(app_id, "approve", body.comment, db, user))


@router.post("/{app_id}/reject", response_model=ApplicationOut)
def reject(app_id: int, body: ApplicationAction, db: Session = Depends(get_db), user: Employee = Depends(current_user)):
    return _to_out(_act(app_id, "reject", body.comment, db, user))
