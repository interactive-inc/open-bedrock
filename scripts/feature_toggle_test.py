"""フィーチャートグルが正しく機能するかの確認スクリプト。

TALENT_FEATURES を変えながら新しい FastAPI アプリを生成し直し、
無効モジュールのエンドポイントが 404 になることを確認する。
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# テスト専用 DB
os.environ["TALENT_DB_URL"] = f"sqlite:///{ROOT / 'talent.featuretest.db'}"
for p in [ROOT / "talent.featuretest.db", ROOT / "talent.featuretest.db-journal"]:
    if p.exists():
        p.unlink()


def _fresh_app(features_value: str):
    """環境変数を変えて server.* を再 import して新しい app を取得。"""
    os.environ["TALENT_FEATURES"] = features_value
    # 一度ロードしたら sys.modules から消す
    for mod in list(sys.modules):
        if mod.startswith("server"):
            del sys.modules[mod]
    server_main = importlib.import_module("server.main")
    server_seed = importlib.import_module("server.seed")
    server_seed.seed()
    return server_main.app


def main() -> int:
    from fastapi.testclient import TestClient

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

    # --- ケース1: コア + skills + dashboard のみ ---
    print("\n[case 1] TALENT_FEATURES='skills,dashboard'")
    app = _fresh_app("skills,dashboard")
    c = TestClient(app)

    r = c.post("/auth/login", json={"email": "engineer-a@inta.co.jp", "password": "engineer-a"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = c.get("/features")
    feats = r.json()
    enabled = {x["name"] for x in feats["optional"] if x["enabled"]}
    disabled = {x["name"] for x in feats["optional"] if not x["enabled"]}
    check("/features 200", r.status_code == 200)
    check("skills, dashboard が enabled", {"skills", "dashboard"} <= enabled)
    check("goals, knowledge は disabled", {"goals", "knowledge", "applications"} <= disabled)

    check("/skills は 200", c.get("/skills", headers=H).status_code == 200)
    check("/dashboard は 200", c.get("/dashboard", headers=H).status_code == 200)
    check("/goals は 404 (無効)", c.get("/goals", headers=H).status_code == 404)
    check("/knowledge は 404 (無効)", c.get("/knowledge", headers=H).status_code == 404)
    check("/applications は 404 (無効)", c.get("/applications", headers=H).status_code == 404)
    check("/employees は 200 (コア)", c.get("/employees", headers=H).status_code == 200)

    # --- ケース2: 除外指定 ---
    print("\n[case 2] TALENT_FEATURES='-surveys,-batch'")
    app = _fresh_app("-surveys,-batch")
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": "engineer-a@inta.co.jp", "password": "engineer-a"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}

    feats = c.get("/features").json()
    enabled = {x["name"] for x in feats["optional"] if x["enabled"]}
    disabled = {x["name"] for x in feats["optional"] if not x["enabled"]}
    check("surveys/batch のみ disabled", disabled == {"surveys", "batch"})
    check("他は enabled", {"skills","goals","oneonone","career","dashboard","knowledge","rooms","applications"} <= enabled)
    check("/surveys は 404", c.get("/surveys", headers=H).status_code == 404)
    check("/batch は 404", c.get("/batch", headers=H).status_code == 404)
    check("/goals は 200", c.get("/goals", headers=H).status_code == 200)
    check("/skills は 200", c.get("/skills", headers=H).status_code == 200)

    # --- ケース3: コアのみ ---
    print("\n[case 3] TALENT_FEATURES='none'")
    app = _fresh_app("none")
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": "engineer-a@inta.co.jp", "password": "engineer-a"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    feats = c.get("/features").json()
    check("すべての optional が disabled",
          all(not x["enabled"] for x in feats["optional"]))
    check("/skills/goals/oneonone/surveys/career/batch/dashboard 全部 404",
          all(c.get(p, headers=H).status_code == 404
              for p in ["/skills", "/goals", "/oneonone", "/surveys",
                        "/career/postings", "/batch", "/dashboard",
                        "/knowledge", "/rooms", "/applications"]))
    check("/employees は 200 (コア)", c.get("/employees", headers=H).status_code == 200)
    check("/me は 200 (コア)", c.get("/me", headers=H).status_code == 200)

    # --- ケース4: 全部ON (デフォルト) ---
    print("\n[case 4] TALENT_FEATURES='all'")
    app = _fresh_app("all")
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": "engineer-a@inta.co.jp", "password": "engineer-a"})
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    feats = c.get("/features").json()
    check("all 指定で optional 全 enabled",
          all(x["enabled"] for x in feats["optional"]))

    print(f"\n== feature toggle: OK={ok}  NG={ng} ==")

    for p in [ROOT / "talent.featuretest.db", ROOT / "talent.featuretest.db-journal"]:
        if p.exists():
            p.unlink()

    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
