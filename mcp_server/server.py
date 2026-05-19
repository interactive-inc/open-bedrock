"""社内HR統合システム MCPサーバ。

stdio で起動する MCP サーバ。Claude 等の AI から、コア API 上の
社員検索・申請提出・申請承認・ナレッジ検索・会議室予約を実行できる。

環境変数:
  TALENT_API   : コアAPIのベースURL (default: http://127.0.0.1:8000)
  TALENT_TOKEN : Bearerトークン（事前に CLI の `talent login` で取得）

起動例:
  TALENT_API=http://127.0.0.1:8000 \\
  TALENT_TOKEN=$(jq -r .token ~/.talent/config.json) \\
  python -m mcp_server.server
"""
from __future__ import annotations

import os
import json
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get("TALENT_API", "http://127.0.0.1:8000")
TOKEN = os.environ.get("TALENT_TOKEN", "")

mcp = FastMCP("talent-hr")


@mcp.tool()
def get_features() -> Any:
    """サーバで有効になっているフィーチャー一覧を取得する。"""
    with _client() as c:
        return _result(c.get("/features"))


def _client() -> httpx.Client:
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    return httpx.Client(base_url=BASE_URL, headers=headers, timeout=15.0, trust_env=False)


def _result(r: httpx.Response) -> Any:
    if r.status_code >= 400:
        return {"error": True, "status": r.status_code, "body": _safe_json(r)}
    return _safe_json(r)


def _safe_json(r: httpx.Response):
    try:
        return r.json()
    except Exception:
        return r.text


# ---------- employees ----------
@mcp.tool()
def search_employees(q: str | None = None, dept: str | None = None, status: str | None = None) -> Any:
    """社員を検索する。q は氏名/カナ/メール/コードの部分一致。"""
    with _client() as c:
        return _result(c.get("/employees", params={"q": q, "dept": dept, "status": status}))


@mcp.tool()
def get_employee(employee_id: int) -> Any:
    """指定IDの社員詳細を取得する。"""
    with _client() as c:
        return _result(c.get(f"/employees/{employee_id}"))


# ---------- application templates ----------
@mcp.tool()
def list_application_templates(category: str | None = None) -> Any:
    """申請テンプレートを一覧する。category 例: ライフイベント, 各種申請, 社内資産。"""
    with _client() as c:
        return _result(c.get("/templates", params={"category": category}))


@mcp.tool()
def get_application_template(code: str) -> Any:
    """申請テンプレート詳細（フィールド定義を含む）を取得する。code は APP-001 等。"""
    with _client() as c:
        return _result(c.get(f"/templates/{code}"))


# ---------- applications ----------
@mcp.tool()
def submit_application(template_code: str, payload: dict) -> Any:
    """申請を提出する。
    引数:
      template_code: 例 "APP-001"
      payload: 申請内容（テンプレートのJSON Schemaに従う）
    """
    with _client() as c:
        return _result(c.post("/applications", json={"template_code": template_code, "payload": payload}))


@mcp.tool()
def list_my_applications(status: str | None = None) -> Any:
    """自分が出した申請を一覧する。status: awaiting_approval/approved/rejected"""
    with _client() as c:
        return _result(c.get("/applications", params={"status": status}))


@mcp.tool()
def list_inbox() -> Any:
    """自分が承認すべき申請（承認待ち）を一覧する。"""
    with _client() as c:
        return _result(c.get("/applications/inbox"))


@mcp.tool()
def approve_application(application_id: int, comment: str | None = None) -> Any:
    """申請を承認する。"""
    with _client() as c:
        return _result(c.post(f"/applications/{application_id}/approve", json={"comment": comment}))


@mcp.tool()
def reject_application(application_id: int, reason: str) -> Any:
    """申請を却下する。reason は必須。"""
    with _client() as c:
        return _result(c.post(f"/applications/{application_id}/reject", json={"comment": reason}))


@mcp.tool()
def get_application(application_id: int) -> Any:
    """申請の詳細・承認経路を取得する。"""
    with _client() as c:
        return _result(c.get(f"/applications/{application_id}"))


# ---------- knowledge ----------
@mcp.tool()
def search_knowledge(q: str | None = None, category: str | None = None) -> Any:
    """ナレッジ（規程・ガイド・マニュアル等）を検索する。"""
    with _client() as c:
        return _result(c.get("/knowledge", params={"q": q, "category": category}))


@mcp.tool()
def get_knowledge(knowledge_id: int) -> Any:
    """ナレッジ本文を取得する。"""
    with _client() as c:
        return _result(c.get(f"/knowledge/{knowledge_id}"))


# ---------- rooms ----------
@mcp.tool()
def check_room_availability(start_at: str, end_at: str, capacity: int = 0) -> Any:
    """会議室の空き状況を確認する。日時は ISO8601 (例: 2026-05-19T10:00:00)。"""
    with _client() as c:
        return _result(c.get("/rooms/availability",
                             params={"start_at": start_at, "end_at": end_at, "capacity": capacity}))


@mcp.tool()
def reserve_room(room_id: int, start_at: str, end_at: str, purpose: str | None = None) -> Any:
    """会議室を予約する。"""
    with _client() as c:
        return _result(c.post("/rooms/reservations",
                              json={"room_id": room_id, "start_at": start_at, "end_at": end_at, "purpose": purpose}))


# ============================================================
# タレントパレット相当の追加ツール
# ============================================================


@mcp.tool()
def list_skills(q: str | None = None, category: str | None = None) -> Any:
    """スキルマスタを検索する。"""
    with _client() as c:
        return _result(c.get("/skills", params={"q": q, "category": category}))


@mcp.tool()
def get_my_skills() -> Any:
    """自分が登録しているスキル一覧。"""
    with _client() as c:
        return _result(c.get("/skills/me"))


@mcp.tool()
def upsert_my_skill(skill_code: str, level: int, years: float | None = None, note: str | None = None) -> Any:
    """自分のスキルを登録/更新する。level=1〜5。"""
    body = {"skill_code": skill_code, "level": level}
    if years is not None: body["years"] = years
    if note is not None: body["note"] = note
    with _client() as c:
        return _result(c.put("/skills/me", json=body))


@mcp.tool()
def get_employee_skills(employee_id: int) -> Any:
    """指定社員のスキル一覧。"""
    with _client() as c:
        return _result(c.get(f"/skills/employees/{employee_id}"))


@mcp.tool()
def list_goals(period: str | None = None, employee_id: int | None = None) -> Any:
    """MBO目標一覧。period 例: '2026H1'。"""
    with _client() as c:
        return _result(c.get("/goals", params={"period": period, "employee_id": employee_id}))


@mcp.tool()
def create_goal(period: str, title: str, kpi: str | None = None, weight: int = 10,
                description: str | None = None) -> Any:
    """自分の目標を作成する。"""
    body = {"period": period, "title": title, "weight": weight}
    if kpi: body["kpi"] = kpi
    if description: body["description"] = description
    with _client() as c:
        return _result(c.post("/goals", json=body))


@mcp.tool()
def evaluate_goal(goal_id: int, kind: str, score: int | None = None, comment: str | None = None) -> Any:
    """目標に対する評価を提出する。kind は self/manager/final のいずれか。"""
    body = {"kind": kind}
    if score is not None: body["score"] = score
    if comment: body["comment"] = comment
    with _client() as c:
        return _result(c.post(f"/goals/{goal_id}/evaluations", json=body))


@mcp.tool()
def list_one_on_ones() -> Any:
    """1on1履歴（自分が member or manager のもの）。"""
    with _client() as c:
        return _result(c.get("/oneonone"))


@mcp.tool()
def create_one_on_one(member_email: str, topics: str | None = None,
                      manager_note: str | None = None, next_action: str | None = None) -> Any:
    """1on1の記録を作成（マネージャー以上）。"""
    body = {"member_email": member_email}
    if topics: body["topics"] = topics
    if manager_note: body["manager_note"] = manager_note
    if next_action: body["next_action"] = next_action
    with _client() as c:
        return _result(c.post("/oneonone", json=body))


@mcp.tool()
def list_surveys() -> Any:
    """オープン中のアンケート一覧。"""
    with _client() as c:
        return _result(c.get("/surveys"))


@mcp.tool()
def submit_survey_response(survey_id: int, answers: dict) -> Any:
    """アンケートに回答する。answers は {'q1': '高い', ...} 形式。"""
    with _client() as c:
        return _result(c.post(f"/surveys/{survey_id}/responses", json={"answers_json": answers}))


@mcp.tool()
def get_survey_summary(survey_id: int) -> Any:
    """アンケートの集計（hr/admin限定）。"""
    with _client() as c:
        return _result(c.get(f"/surveys/{survey_id}/summary"))


@mcp.tool()
def get_my_career_sheet() -> Any:
    """自分のキャリアシートを取得。"""
    with _client() as c:
        return _result(c.get("/career/sheet/me"))


@mcp.tool()
def update_my_career_sheet(history: str | None = None, strengths: str | None = None,
                           aspirations: str | None = None, self_pr: str | None = None) -> Any:
    """自分のキャリアシートを更新（部分指定可）。"""
    body = {}
    if history is not None: body["history"] = history
    if strengths is not None: body["strengths"] = strengths
    if aspirations is not None: body["aspirations"] = aspirations
    if self_pr is not None: body["self_pr"] = self_pr
    with _client() as c:
        return _result(c.put("/career/sheet/me", json=body))


@mcp.tool()
def list_career_postings() -> Any:
    """社内公募（キャリアボード）一覧。"""
    with _client() as c:
        return _result(c.get("/career/postings"))


@mcp.tool()
def apply_career_posting(posting_id: int, message: str | None = None) -> Any:
    """社内公募に応募する。"""
    with _client() as c:
        return _result(c.post(f"/career/postings/{posting_id}/apply", json={"message": message}))


@mcp.tool()
def list_batch_jobs(status: str | None = None, limit: int = 20) -> Any:
    """バッチ実行履歴を取得する。"""
    with _client() as c:
        return _result(c.get("/batch", params={"status": status, "limit": limit}))


@mcp.tool()
def get_dashboard() -> Any:
    """ダッシュボード（集計値）を取得する。"""
    with _client() as c:
        return _result(c.get("/dashboard"))


if __name__ == "__main__":
    mcp.run()
