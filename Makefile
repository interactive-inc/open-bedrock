.PHONY: help dev cli designer pm

help:
	@echo "open-karte - 主な make ターゲット"
	@echo "  make dev        bun install して portless で全アプリを起動"
	@echo "  make cli        CLI ヘルプを表示 (bun)"
	@echo "  make designer   プロダクトデザイナーのエージェントを起動 (claude)"
	@echo "  make pm         PM エージェントを funnel 経由で起動 (claude-funnel)"

dev:
	bun install
	portless

cli:
	bun cli/index.ts --help

designer:
	claude --agent product-designer

pm:
	bunx funnel claude --profile open-karte
