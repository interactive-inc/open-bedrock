.PHONY: help dependencies worktree dev cli designer pm

help:
	@echo "open-karte - 主な make ターゲット"
	@echo "  make worktree   worktree の依存を初期化"
	@echo "  make dev        bun install して portless で全アプリを起動"
	@echo "  make cli        CLI ヘルプを表示 (bun)"
	@echo "  make designer   プロダクトデザイナーのエージェントを起動 (claude)"
	@echo "  make pm         PM エージェントを funnel 経由で起動 (claude-funnel)"

dependencies:
	bun install
	@if [ ! -d node_modules ] || [ ! -d api/node_modules ] || [ ! -d cli/node_modules ] || [ ! -d web/node_modules ]; then \
	  echo "node_modules missing after bun install; retrying with --force"; \
	  bun install --force; \
	fi

worktree: dependencies

dev: dependencies
	portless

cli:
	bun cli/index.ts --help

designer:
	claude --agent product-designer

pm:
	bunx funnel claude --profile open-karte --dangerously-skip-permissions
