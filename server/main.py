"""社内HR統合システム コアAPI。

各モジュールは TALENT_FEATURES 環境変数で ON/OFF できる。詳細は features.py を参照。
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .db import Base, engine
from . import features as F
from .routers import (
    auth, employees, departments, templates, applications, knowledge, rooms,
    skills, goals, oneonone, surveys, career, batch, dashboard,
    ui,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="open-karte API",
    description=(
        "オープンソースの社内HR統合プラットフォーム — "
        "API/CLI/MCPの三層対応。各モジュールはフィーチャートグルでON/OFF可能。"
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# モジュール名 → ルーターのマップ
_OPTIONAL_ROUTERS = {
    "applications": applications.router,
    "knowledge":    knowledge.router,
    "rooms":        rooms.router,
    "skills":       skills.router,
    "goals":        goals.router,
    "oneonone":     oneonone.router,
    "surveys":      surveys.router,
    "career":       career.router,
    "batch":        batch.router,
    "dashboard":    dashboard.router,
}

# コア（常に有効）
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(templates.router)

# オプション（フィーチャー設定に従う）
_enabled = F.enabled_features()
for name, router in _OPTIONAL_ROUTERS.items():
    if name in _enabled:
        app.include_router(router)


# Web UI（一般ユーザー向け）
app.include_router(ui.router)


@app.get("/", include_in_schema=False)
def root():
    """ルートはWeb UIのダッシュボードへ。トークンがなければ login.html 側で /login にリダイレクト。"""
    return RedirectResponse(url="/app/dashboard")


@app.get("/features")
def get_features():
    """有効化されているフィーチャー一覧。"""
    return F.features_status()
