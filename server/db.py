"""DB セットアップ。SQLite で動作するが、URL 差し替えで PostgreSQL も可。"""
from __future__ import annotations

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# 既定では「talent プロジェクト直下の talent.db」を使う。
# 起動ディレクトリに依存しないよう絶対パスに解決する。
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB = (_PROJECT_ROOT / "talent.db").as_posix()
DATABASE_URL = os.environ.get("TALENT_DB_URL", f"sqlite:///{_DEFAULT_DB}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
