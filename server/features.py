"""フィーチャーフラグ。各モジュールを起動時に ON/OFF できる。

環境変数 TALENT_FEATURES の書式:
  - 未指定 / "all"           : すべて有効
  - "none" / "core"          : コア機能（auth, employees, departments, templates）のみ
  - "skills,goals"           : 指定したモジュールのみ（コアは常に有効）
  - "-knowledge,-rooms"      : デフォルト全部 ON から除外
  - "+skills,+goals"         : 同じく include 指定（+ は省略可）

CORE_FEATURES は常に有効。OPTIONAL_FEATURES がトグル対象。
"""
from __future__ import annotations

import os
from typing import Iterable

# 常に有効（システムの根幹）
CORE_FEATURES: tuple[str, ...] = (
    "auth", "employees", "departments", "templates",
)

# 切り替え可能なオプション機能
OPTIONAL_FEATURES: tuple[str, ...] = (
    "applications",   # 申請ワークフロー
    "knowledge",      # ナレッジ
    "rooms",          # 会議室予約
    "skills",         # スキル
    "goals",          # MBO・評価
    "oneonone",       # 1on1
    "surveys",        # アンケート
    "career",         # キャリアシート + キャリアボード(β)
    "batch",          # バッチ状況
    "dashboard",      # ダッシュボード
)


def _normalize(token: str) -> tuple[str, bool]:
    """( name, include? ) を返す。"-name" は include=False。"""
    token = token.strip()
    if not token:
        return ("", True)
    if token.startswith("-"):
        return (token[1:].strip(), False)
    if token.startswith("+"):
        return (token[1:].strip(), True)
    return (token, True)


def _parse(value: str) -> set[str]:
    value = (value or "").strip()
    if not value or value.lower() == "all":
        return set(CORE_FEATURES) | set(OPTIONAL_FEATURES)
    if value.lower() in ("none", "core"):
        return set(CORE_FEATURES)

    tokens = [t for t in value.split(",") if t.strip()]
    normalized = [_normalize(t) for t in tokens]
    has_exclude = any(not inc for _, inc in normalized)
    has_include = any(inc and name not in CORE_FEATURES for name, inc in normalized)

    if has_exclude and not has_include:
        # 「除外モード」: デフォルト全部 ON から指定分を除外
        excluded = {name for name, inc in normalized if not inc}
        return (set(CORE_FEATURES) | set(OPTIONAL_FEATURES)) - excluded

    # 「許可モード」: コア + 明示された OPTIONAL のみ
    included = {name for name, inc in normalized if inc and name in OPTIONAL_FEATURES}
    return set(CORE_FEATURES) | included


def enabled_features() -> set[str]:
    return _parse(os.environ.get("TALENT_FEATURES", ""))


def is_enabled(name: str) -> bool:
    return name in enabled_features()


def features_status() -> dict:
    """ /features エンドポイントで返す情報。"""
    enabled = enabled_features()
    return {
        "raw": os.environ.get("TALENT_FEATURES", "all"),
        "core": list(CORE_FEATURES),
        "optional": [
            {"name": f, "enabled": f in enabled} for f in OPTIONAL_FEATURES
        ],
    }
