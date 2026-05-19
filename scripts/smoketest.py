"""ローカル動作確認用 スモークテスト（TestClient で API を直接実行）。

実行:
    python scripts/smoketest.py

毎回 DB を破棄→再シードしてから実行するので、何度走らせても同じ結果が出る。
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# プロジェクトルートを sys.path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# テスト毎に独立したDBを使う
os.environ["TALENT_DB_URL"] = f"sqlite:///{ROOT / 'talent.test.db'}"
test_db = ROOT / "talent.test.db"
if test_db.exists():
    test_db.unlink()
journal = ROOT / "talent.test.db-journal"
if journal.exists():
    journal.unlink()

from server.seed import seed  # noqa: E402

seed()

from fastapi.testclient import TestClient  # noqa: E402
from server.main import app  # noqa: E402


def jp(o) -> str:
    return json.dumps(o, ensure_ascii=False, indent=2)


def main() -> int:
    c = TestClient(app)
    ok = 0
    ng = 0

    def check(name: str, cond: bool, detail: str = ""):
        nonlocal ok, ng
        if cond:
            ok += 1
            print(f"  ✓ {name}")
        else:
            ng += 1
            print(f"  ✗ {name}  {detail}")

    print("== smoketest start ==")

    # 1. ログイン
    r = c.post("/auth/login", json={"email": "engineer-a@inta.co.jp", "password": "engineer-a"})
    check("login(engineer-a)", r.status_code == 200, r.text)
    tok_t = r.json().get("access_token", "")
    H_T = {"Authorization": f"Bearer {tok_t}"}

    # 2. /me
    r = c.get("/me", headers=H_T)
    me = r.json() if r.status_code == 200 else {}
    check("/me name=エンジニアA", me.get("name") == "エンジニアA", str(me))

    # 3. 社員検索
    r = c.get("/employees", params={"q": "エンジニア"}, headers=H_T)
    check("employees?q=エンジニア ≥2件", r.status_code == 200 and len(r.json()) >= 2)

    # 4. テンプレート
    r = c.get("/templates", headers=H_T)
    codes = {t["code"] for t in r.json()}
    check("templates 5件", codes >= {"APP-001", "APP-017", "APP-018", "APP-020", "APP-024"})

    # 5. 住所変更 提出
    payload = {
        "new_postal_code": "100-0001",
        "new_address": "東京都千代田区千代田1-1",
        "move_date": "2026-06-01",
        "new_commute": "東京メトロ千代田線",
    }
    r = c.post("/applications", json={"template_code": "APP-001", "payload": payload}, headers=H_T)
    check("submit APP-001", r.status_code == 200, r.text)
    app1 = r.json()
    app_id = app1.get("id")

    # 6. manager 承認
    r = c.post("/auth/login", json={"email": "manager@inta.co.jp", "password": "manager"})
    H_M = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = c.get("/applications/inbox", headers=H_M)
    check("manager inbox に住所変更", any(a["id"] == app_id for a in r.json()))
    r = c.post(f"/applications/{app_id}/approve", json={"comment": "OK"}, headers=H_M)
    check("manager approve → step=2", r.status_code == 200 and r.json().get("current_step") == 2)

    # 7. hr 承認 → 完了
    r = c.post("/auth/login", json={"email": "hr@inta.co.jp", "password": "hr"})
    H_H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = c.post(f"/applications/{app_id}/approve", json={"comment": "受理"}, headers=H_H)
    check("hr approve → approved", r.status_code == 200 and r.json().get("status") == "approved")

    # 8. ナレッジ検索
    r = c.get("/knowledge", params={"q": "リモート"}, headers=H_T)
    check("knowledge?q=リモート", r.status_code == 200 and len(r.json()) >= 1)

    # 9. 会議室の空き
    r = c.get(
        "/rooms/availability",
        params={"start_at": "2026-05-19T10:00:00", "end_at": "2026-05-19T11:00:00", "capacity": 4},
        headers=H_T,
    )
    rooms = r.json() if r.status_code == 200 else []
    check("rooms availability ≥1", len(rooms) >= 1)

    # 10. 会議室予約 + ダブルブッキング
    rid = rooms[0]["room"]["id"] if rooms else None
    r = c.post(
        "/rooms/reservations",
        json={"room_id": rid, "start_at": "2026-05-19T10:00:00",
              "end_at": "2026-05-19T11:00:00", "purpose": "smoketest"},
        headers=H_T,
    )
    check("reserve room 200", r.status_code == 200, r.text)
    r2 = c.post(
        "/rooms/reservations",
        json={"room_id": rid, "start_at": "2026-05-19T10:30:00",
              "end_at": "2026-05-19T11:30:00", "purpose": "conflict"},
        headers=H_T,
    )
    check("reserve room 409 (conflict)", r2.status_code == 409)

    # 11. バリデーション(required欠落)
    r = c.post("/applications",
               json={"template_code": "APP-001", "payload": {"new_postal_code": "x"}},
               headers=H_T)
    check("submit invalid → 422", r.status_code == 422)

    # 12. スキル
    r = c.get("/skills", params={"q": "Python"}, headers=H_T)
    check("skills?q=Python", r.status_code == 200 and len(r.json()) >= 1)
    r = c.put("/skills/me", json={"skill_code": "SK-EN", "level": 3, "years": 1.0}, headers=H_T)
    check("upsert my skill", r.status_code == 200 and r.json()["level"] == 3)

    # 13. MBO
    r = c.get("/goals", params={"period": "2026H1"}, headers=H_T)
    goals = r.json() if r.status_code == 200 else []
    check("goals 2026H1 ≥1", len(goals) >= 1)
    if goals:
        gid = goals[0]["id"]
        r = c.post(f"/goals/{gid}/evaluations", json={"kind": "self", "score": 80, "comment": "順調"}, headers=H_T)
        check("self evaluation", r.status_code == 200)

    # 14. 1on1（managerで作成）
    r = c.post("/oneonone",
               json={"member_email": "engineer-a@inta.co.jp", "topics": "今期目標", "manager_note": "OK"},
               headers=H_M)
    check("create 1on1 (manager)", r.status_code == 200)
    r = c.get("/oneonone", headers=H_M)
    check("manager の 1on1 履歴", r.status_code == 200 and len(r.json()) >= 1)

    # 15. アンケート
    r = c.get("/surveys", headers=H_T)
    surveys = r.json() if r.status_code == 200 else []
    check("open surveys ≥1", len(surveys) >= 1)
    if surveys:
        sid = surveys[0]["id"]
        # engineer-a は seed で既に回答済みなので 409、テスト用に DB を再シードした場合は 200
        r = c.post(f"/surveys/{sid}/responses",
                   json={"answers_json": {"q1": "高い", "q2": "高い", "q3": "smoketest"}},
                   headers={"Authorization": f"Bearer {tok_t}"})
        check("submit response (200 or 409)", r.status_code in (200, 409))

    # 16. キャリアシート
    r = c.get("/career/sheet/me", headers=H_T)
    check("my career sheet", r.status_code == 200)
    r = c.put("/career/sheet/me", json={"self_pr": "smoketest更新"}, headers=H_T)
    check("update career sheet", r.status_code == 200 and r.json()["self_pr"] == "smoketest更新")

    # 17. キャリアボード(β)
    r = c.get("/career/postings", headers=H_T)
    postings = r.json() if r.status_code == 200 else []
    check("career postings ≥1", len(postings) >= 1)
    if postings:
        pid = postings[0]["id"]
        r = c.post(f"/career/postings/{pid}/apply",
                   json={"message": "応募します"}, headers=H_T)
        check("apply posting", r.status_code == 200)

    # 18. バッチ状況（管理者/人事向け。member は audience 制約で 0 件）
    r = c.get("/batch", headers=H_H)
    check("batch jobs ≥4 (hr)", r.status_code == 200 and len(r.json()) >= 4)
    r2 = c.get("/batch", headers=H_T)
    check("batch jobs == 0 (member)", r2.status_code == 200 and len(r2.json()) == 0)

    # 19. ダッシュボード
    r = c.get("/dashboard", headers=H_M)
    d = r.json() if r.status_code == 200 else {}
    check("dashboard headcount≥6", d.get("headcount_total", 0) >= 6)
    check("dashboard inbox_count present", "open_inbox_count_for_me" in d)

    # 20. フィーチャー一覧
    r = c.get("/features")
    feats = r.json() if r.status_code == 200 else {}
    check("/features 200", r.status_code == 200)
    opt_names = {x["name"] for x in feats.get("optional", [])}
    check("/features optional に skills/goals/oneonone/surveys/career/batch/dashboard が含まれる",
          {"skills","goals","oneonone","surveys","career","batch","dashboard"} <= opt_names)
    check("デフォルトは全部 enabled",
          all(x["enabled"] for x in feats.get("optional", [])))

    print(f"\n== summary: OK={ok}  NG={ng} ==")

    # 後始末
    try:
        test_db.unlink()
    except FileNotFoundError:
        pass
    try:
        journal.unlink()
    except FileNotFoundError:
        pass

    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
