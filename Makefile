PYTHON ?= python3
PORT   ?= 8000
VENV   := .venv
PY     := $(VENV)/bin/python
PIP    := $(VENV)/bin/pip

.PHONY: help venv install verify seed reseed run cli mcp smoketest feature-test clean

help:
	@echo "社内HR統合システム - 主な make ターゲット"
	@echo "  make install    venv作成 + 依存インストール"
	@echo "  make seed       サンプルデータ投入 (talent.db 新規作成)"
	@echo "  make reseed     既存DBを破棄して再シード"
	@echo "  make run        APIサーバ起動 (http://127.0.0.1:$(PORT))"
	@echo "  make smoketest  E2E動作確認 (TestClient)"
	@echo "  make feature-test  フィーチャートグル動作確認"
	@echo "  make cli        CLIヘルプ"
	@echo "  make mcp        MCPサーバ起動"
	@echo "  make clean      生成物を削除"

$(VENV)/bin/activate:
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PIP) install -r requirements.txt
	$(PIP) install email-validator

install: $(VENV)/bin/activate verify

# 依存パッケージが入っているか確認。欠けていれば pip install をやり直す。
verify:
	@$(PY) -c "import fastapi, uvicorn, sqlalchemy, click, mcp" 2>/dev/null \
	  && echo "✓ deps OK ($(VENV))" \
	  || (echo "⚠ deps missing — reinstalling..." && \
	      $(PIP) install -r requirements.txt && \
	      $(PIP) install email-validator && \
	      echo "✓ deps OK ($(VENV))")

seed: install
	$(PY) -m server.seed

reseed: install
	rm -f talent.db talent.db-journal
	$(PY) -m server.seed

run: install
	@test -f talent.db || $(MAKE) seed
	$(PY) -m uvicorn server.main:app --reload --host 127.0.0.1 --port $(PORT)

cli: install
	$(PY) -m cli.talent --help

mcp: install
	$(PY) -m mcp_server.server

smoketest: install
	@test -f talent.db || $(MAKE) seed
	$(PY) scripts/smoketest.py

feature-test: install
	$(PY) scripts/feature_toggle_test.py

clean:
	rm -rf $(VENV) talent.db talent.db-journal
	find . -name __pycache__ -type d -exec rm -rf {} +
