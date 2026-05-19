"""一般ユーザー向け Web UI (Jinja2)。

APIは別途認証つきで叩く。各ページはトークン未保有なら /login へ JS で誘導。
"""
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(include_in_schema=False)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))


def _page(request: Request, name: str) -> HTMLResponse:
    return templates.TemplateResponse(request, name)


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return _page(request, "login.html")


@router.get("/app", response_class=HTMLResponse)
def app_root(request: Request):
    return _page(request, "dashboard.html")


@router.get("/app/dashboard", response_class=HTMLResponse)
def app_dashboard(request: Request):
    return _page(request, "dashboard.html")


@router.get("/app/applications", response_class=HTMLResponse)
def app_applications(request: Request):
    return _page(request, "applications.html")


@router.get("/app/inbox", response_class=HTMLResponse)
def app_inbox(request: Request):
    return _page(request, "inbox.html")


@router.get("/app/knowledge", response_class=HTMLResponse)
def app_knowledge(request: Request):
    return _page(request, "knowledge.html")
