"""社内HR統合システム CLI (talent)。

設定ファイル: ~/.talent/config.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Optional

import click
import httpx
from rich.console import Console
from rich.table import Table
from rich import print as rprint

CONFIG_DIR = Path(os.path.expanduser("~/.talent"))
CONFIG_FILE = CONFIG_DIR / "config.json"
DEFAULT_BASE_URL = os.environ.get("TALENT_API", "http://127.0.0.1:8000")
console = Console()


def _load() -> dict:
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text())
    return {"base_url": DEFAULT_BASE_URL, "token": None}


def _save(cfg: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False))


def _client() -> httpx.Client:
    cfg = _load()
    headers = {"Authorization": f"Bearer {cfg['token']}"} if cfg.get("token") else {}
    return httpx.Client(
        base_url=cfg["base_url"], headers=headers, timeout=15.0,
        # システム側のプロキシ設定をローカル localhost API では使わない
        trust_env=False,
    )


def _check(r: httpx.Response):
    if r.status_code >= 400:
        try:
            msg = r.json()
        except Exception:
            msg = r.text
        console.print(f"[red]ERR {r.status_code}[/red] {msg}")
        sys.exit(1)


@click.group(help="社内HR統合システム CLI")
def cli():
    pass


# ---------- auth ----------
@cli.command()
@click.option("--email", prompt=True)
@click.option("--password", prompt=True, hide_input=True)
@click.option("--base-url", default=None, help="APIエンドポイント上書き")
def login(email, password, base_url):
    """ログインしてトークンを取得"""
    cfg = _load()
    if base_url:
        cfg["base_url"] = base_url
    with httpx.Client(trust_env=False, timeout=15.0) as _c:
        r = _c.post(f"{cfg['base_url']}/auth/login", json={"email": email, "password": password})
    _check(r)
    cfg["token"] = r.json()["access_token"]
    _save(cfg)
    console.print(f"[green]ログイン成功[/green] base_url={cfg['base_url']}")


@cli.command()
def whoami():
    """自分の情報を表示"""
    with _client() as c:
        r = c.get("/me")
    _check(r)
    rprint(r.json())


@cli.command()
def features():
    """サーバで有効化されているフィーチャー一覧"""
    with _client() as c:
        r = c.get("/features")
    _check(r)
    data = r.json()
    console.print(f"[bold]TALENT_FEATURES=[/bold] {data.get('raw')}")
    t = Table(title="フィーチャー一覧")
    t.add_column("name"); t.add_column("kind"); t.add_column("enabled")
    for n in data.get("core", []):
        t.add_row(n, "core", "[green]●[/green]")
    for x in data.get("optional", []):
        mark = "[green]●[/green]" if x["enabled"] else "[red]○[/red]"
        t.add_row(x["name"], "optional", mark)
    console.print(t)


# ---------- employees ----------
@cli.group()
def employee():
    """社員関連"""


@employee.command("search")
@click.option("--q", default=None)
@click.option("--dept", default=None)
@click.option("--status", default=None)
def emp_search(q, dept, status):
    with _client() as c:
        r = c.get("/employees", params={"q": q, "dept": dept, "status": status})
    _check(r)
    rows = r.json()
    t = Table(title=f"社員検索結果 ({len(rows)}件)")
    for col in ["code", "name", "dept_name", "position", "email", "status", "role"]:
        t.add_column(col)
    for u in rows:
        t.add_row(*[str(u.get(c) or "") for c in ["code", "name", "dept_name", "position", "email", "status", "role"]])
    console.print(t)


# ---------- applications ----------
@cli.group()
def app():
    """申請ワークフロー"""


@app.command("templates")
@click.option("--category", default=None)
def app_templates(category):
    """申請テンプレート一覧"""
    with _client() as c:
        r = c.get("/templates", params={"category": category})
    _check(r)
    rows = r.json()
    t = Table(title=f"申請テンプレート ({len(rows)}件)")
    for col in ["code", "name", "category", "description"]:
        t.add_column(col)
    for x in rows:
        t.add_row(x["code"], x["name"], x["category"], (x.get("description") or "")[:40])
    console.print(t)


@app.command("template")
@click.argument("code")
def app_template(code):
    """申請テンプレート詳細（フィールド定義含む）"""
    with _client() as c:
        r = c.get(f"/templates/{code}")
    _check(r)
    rprint(r.json())


@app.command("submit")
@click.argument("template_code")
@click.option("--data", "data_file", type=click.Path(exists=True, dir_okay=False),
              help="payloadのJSONファイル（指定がなければ標準入力）")
def app_submit(template_code, data_file):
    """申請を提出"""
    if data_file:
        payload = json.loads(Path(data_file).read_text(encoding="utf-8"))
    else:
        console.print("payload (JSON) を入力し EOF (Ctrl-D / Ctrl-Z+Enter):")
        payload = json.loads(sys.stdin.read())
    with _client() as c:
        r = c.post("/applications", json={"template_code": template_code, "payload": payload})
    _check(r)
    rprint(r.json())


@app.command("inbox")
def app_inbox():
    """自分宛の承認待ち一覧"""
    with _client() as c:
        r = c.get("/applications/inbox")
    _check(r)
    rows = r.json()
    t = Table(title=f"承認待ち ({len(rows)}件)")
    for col in ["id", "template_name", "applicant_name", "current_step", "status", "created_at"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["template_name"], x["applicant_name"],
                  str(x["current_step"]), x["status"], x["created_at"])
    console.print(t)


@app.command("mine")
@click.option("--status", default=None)
def app_mine(status):
    """自分の申請一覧"""
    with _client() as c:
        r = c.get("/applications", params={"status": status})
    _check(r)
    rows = r.json()
    t = Table(title=f"自分の申請 ({len(rows)}件)")
    for col in ["id", "template_name", "status", "current_step", "created_at"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["template_name"], x["status"], str(x["current_step"]), x["created_at"])
    console.print(t)


@app.command("show")
@click.argument("app_id", type=int)
def app_show(app_id):
    """申請の詳細表示"""
    with _client() as c:
        r = c.get(f"/applications/{app_id}")
    _check(r)
    rprint(r.json())


@app.command("approve")
@click.argument("app_id", type=int)
@click.option("--comment", default=None)
def app_approve(app_id, comment):
    """申請を承認"""
    with _client() as c:
        r = c.post(f"/applications/{app_id}/approve", json={"comment": comment})
    _check(r)
    console.print(f"[green]approved[/green] id={app_id} status={r.json()['status']}")


@app.command("reject")
@click.argument("app_id", type=int)
@click.option("--comment", required=True)
def app_reject(app_id, comment):
    """申請を却下"""
    with _client() as c:
        r = c.post(f"/applications/{app_id}/reject", json={"comment": comment})
    _check(r)
    console.print(f"[red]rejected[/red] id={app_id} status={r.json()['status']}")


# ---------- knowledge ----------
@cli.group()
def kb():
    """ナレッジ"""


@kb.command("search")
@click.argument("q", required=False, default=None)
@click.option("--category", default=None)
def kb_search(q, category):
    with _client() as c:
        r = c.get("/knowledge", params={"q": q, "category": category})
    _check(r)
    rows = r.json()
    t = Table(title=f"ナレッジ検索 ({len(rows)}件)")
    for col in ["id", "category", "title", "snippet"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["category"], x["title"], (x.get("snippet") or "")[:60])
    console.print(t)


@kb.command("get")
@click.argument("kid", type=int)
def kb_get(kid):
    with _client() as c:
        r = c.get(f"/knowledge/{kid}")
    _check(r)
    data = r.json()
    console.rule(f"[bold cyan]{data['title']}[/bold cyan]")
    console.print(f"[dim]category={data['category']} tags={data.get('tags') or ''}[/dim]")
    console.print(data["body_md"])


# ---------- rooms ----------
@cli.group()
def room():
    """会議室"""


@room.command("avail")
@click.option("--start", "start_at", required=True, help="ISO8601 (e.g. 2026-05-19T10:00)")
@click.option("--end", "end_at", required=True)
@click.option("--capacity", default=0, type=int)
def room_avail(start_at, end_at, capacity):
    with _client() as c:
        r = c.get("/rooms/availability",
                  params={"start_at": start_at, "end_at": end_at, "capacity": capacity})
    _check(r)
    rows = r.json()
    t = Table(title="会議室空き状況")
    for col in ["id", "name", "capacity", "available", "conflicts"]:
        t.add_column(col)
    for x in rows:
        room = x["room"]
        t.add_row(str(room["id"]), room["name"], str(room["capacity"]),
                  "○" if x["available"] else "×",
                  ", ".join(c.get("purpose") or "" for c in x.get("conflicts", [])))
    console.print(t)


@room.command("reserve")
@click.option("--room-id", required=True, type=int)
@click.option("--start", "start_at", required=True)
@click.option("--end", "end_at", required=True)
@click.option("--purpose", default=None)
def room_reserve(room_id, start_at, end_at, purpose):
    with _client() as c:
        r = c.post("/rooms/reservations",
                   json={"room_id": room_id, "start_at": start_at, "end_at": end_at, "purpose": purpose})
    _check(r)
    rprint(r.json())


# ============================================================
# タレントパレット相当の追加コマンド
# ============================================================


@cli.group()
def skill():
    """スキル"""


@skill.command("list")
@click.option("--q", default=None)
@click.option("--category", default=None)
def skill_list(q, category):
    with _client() as c:
        r = c.get("/skills", params={"q": q, "category": category})
    _check(r)
    rows = r.json()
    t = Table(title=f"スキル一覧 ({len(rows)}件)")
    for col in ["code", "name", "category"]:
        t.add_column(col)
    for x in rows:
        t.add_row(x["code"], x["name"], x["category"])
    console.print(t)


@skill.command("mine")
def skill_mine():
    with _client() as c:
        r = c.get("/skills/me")
    _check(r)
    rows = r.json()
    t = Table(title=f"自分のスキル ({len(rows)}件)")
    for col in ["skill_code", "skill_name", "category", "level", "years"]:
        t.add_column(col)
    for x in rows:
        t.add_row(x.get("skill_code") or "", x.get("skill_name") or "",
                  x.get("skill_category") or "", str(x.get("level") or ""), str(x.get("years") or ""))
    console.print(t)


@skill.command("set")
@click.argument("skill_code")
@click.option("--level", type=int, required=True)
@click.option("--years", type=float, default=None)
@click.option("--note", default=None)
def skill_set(skill_code, level, years, note):
    """自分のスキルを登録/更新"""
    payload = {"skill_code": skill_code, "level": level}
    if years is not None: payload["years"] = years
    if note is not None: payload["note"] = note
    with _client() as c:
        r = c.put("/skills/me", json=payload)
    _check(r)
    rprint(r.json())


@cli.group()
def goal():
    """MBO 目標・評価"""


@goal.command("list")
@click.option("--period", default=None)
@click.option("--employee-id", type=int, default=None)
def goal_list(period, employee_id):
    params = {}
    if period: params["period"] = period
    if employee_id: params["employee_id"] = employee_id
    with _client() as c:
        r = c.get("/goals", params=params)
    _check(r)
    rows = r.json()
    t = Table(title=f"目標一覧 ({len(rows)}件)")
    for col in ["id", "period", "title", "status", "weight"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["period"], x["title"][:30], x["status"], str(x["weight"]))
    console.print(t)


@goal.command("create")
@click.option("--period", required=True, help="例: 2026H1")
@click.option("--title", required=True)
@click.option("--kpi", default=None)
@click.option("--weight", type=int, default=10)
def goal_create(period, title, kpi, weight):
    payload = {"period": period, "title": title, "weight": weight}
    if kpi: payload["kpi"] = kpi
    with _client() as c:
        r = c.post("/goals", json=payload)
    _check(r)
    rprint(r.json())


@goal.command("evaluate")
@click.argument("goal_id", type=int)
@click.option("--kind", type=click.Choice(["self", "manager", "final"]), required=True)
@click.option("--score", type=int, default=None)
@click.option("--comment", default=None)
def goal_evaluate(goal_id, kind, score, comment):
    payload = {"kind": kind}
    if score is not None: payload["score"] = score
    if comment: payload["comment"] = comment
    with _client() as c:
        r = c.post(f"/goals/{goal_id}/evaluations", json=payload)
    _check(r)
    rprint(r.json())


@cli.group("1on1")
def oneonone():
    """1on1"""


@oneonone.command("list")
def oo_list():
    with _client() as c:
        r = c.get("/oneonone")
    _check(r)
    rows = r.json()
    t = Table(title=f"1on1 履歴 ({len(rows)}件)")
    for col in ["id", "held_at", "member_name", "manager_name", "topics"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["held_at"][:16],
                  x.get("member_name") or "", x.get("manager_name") or "",
                  (x.get("topics") or "")[:30])
    console.print(t)


@oneonone.command("create")
@click.option("--member-email", required=True)
@click.option("--topics", default=None)
@click.option("--manager-note", default=None)
@click.option("--next-action", default=None)
def oo_create(member_email, topics, manager_note, next_action):
    payload = {"member_email": member_email}
    if topics: payload["topics"] = topics
    if manager_note: payload["manager_note"] = manager_note
    if next_action: payload["next_action"] = next_action
    with _client() as c:
        r = c.post("/oneonone", json=payload)
    _check(r)
    rprint(r.json())


@cli.group()
def survey():
    """アンケート"""


@survey.command("list")
def survey_list():
    with _client() as c:
        r = c.get("/surveys")
    _check(r)
    rows = r.json()
    t = Table(title=f"オープン中のアンケート ({len(rows)}件)")
    for col in ["id", "title", "status", "questions"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["title"], x["status"], str(len(x["questions_json"])))
    console.print(t)


@survey.command("answer")
@click.argument("survey_id", type=int)
@click.option("--data", "data_file", type=click.Path(exists=True))
def survey_answer(survey_id, data_file):
    """アンケート回答（JSONファイル: {"q1":"高い","q2":"普通"}）"""
    payload = json.loads(Path(data_file).read_text(encoding="utf-8"))
    with _client() as c:
        r = c.post(f"/surveys/{survey_id}/responses", json={"answers_json": payload})
    _check(r)
    rprint(r.json())


@survey.command("summary")
@click.argument("survey_id", type=int)
def survey_summary(survey_id):
    with _client() as c:
        r = c.get(f"/surveys/{survey_id}/summary")
    _check(r)
    rprint(r.json())


@cli.group()
def career():
    """キャリアシート + キャリアボード(β)"""


@career.command("sheet")
def career_sheet():
    with _client() as c:
        r = c.get("/career/sheet/me")
    _check(r)
    rprint(r.json())


@career.command("sheet-update")
@click.option("--data", "data_file", required=True, type=click.Path(exists=True))
def career_sheet_update(data_file):
    payload = json.loads(Path(data_file).read_text(encoding="utf-8"))
    with _client() as c:
        r = c.put("/career/sheet/me", json=payload)
    _check(r)
    rprint(r.json())


@career.command("postings")
def career_postings():
    with _client() as c:
        r = c.get("/career/postings")
    _check(r)
    rows = r.json()
    t = Table(title=f"社内公募 ({len(rows)}件)")
    for col in ["id", "title", "dept_name", "required_skills", "status"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["title"], x.get("dept_name") or "",
                  x.get("required_skills") or "", x["status"])
    console.print(t)


@career.command("apply")
@click.argument("posting_id", type=int)
@click.option("--message", default=None)
def career_apply(posting_id, message):
    with _client() as c:
        r = c.post(f"/career/postings/{posting_id}/apply", json={"message": message})
    _check(r)
    rprint(r.json())


@cli.command()
def batch():
    """バッチ状況を表示"""
    with _client() as c:
        r = c.get("/batch")
    _check(r)
    rows = r.json()
    t = Table(title=f"バッチ状況 ({len(rows)}件)")
    for col in ["id", "name", "status", "started_at", "finished_at", "message"]:
        t.add_column(col)
    for x in rows:
        t.add_row(str(x["id"]), x["name"], x["status"],
                  (x["started_at"] or "")[:19], (x.get("finished_at") or "")[:19],
                  (x.get("message") or "")[:40])
    console.print(t)


@cli.command()
def dashboard():
    """ダッシュボード（集計）を表示"""
    with _client() as c:
        r = c.get("/dashboard")
    _check(r)
    rprint(r.json())


if __name__ == "__main__":
    cli()
