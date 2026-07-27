import { factory } from "@/factory"

export const help = `bedrock stocktakes — 棚卸し

usage:
  bedrock stocktakes list [--status open|closed]              セッション一覧
  bedrock stocktakes start --name <n> --target-date <d>       セッション開始
  bedrock stocktakes show <id>                                詳細（確認状況）
  bedrock stocktakes check <id> --asset-code <c> [--location-note <m>]  現物確認を記録
  bedrock stocktakes close <id>                               セッションを締める`

export default factory.createHandlers((c) => c.text(help))
