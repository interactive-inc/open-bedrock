import { factory } from "@/factory"

export const help = `bedrock stocktake — 棚卸し

usage:
  bedrock stocktake list [--status open|closed]              セッション一覧
  bedrock stocktake start --name <n> --target-date <d>       セッション開始
  bedrock stocktake show <id>                                詳細（確認状況）
  bedrock stocktake check <id> --asset-code <c> [--location-note <m>]  現物確認を記録
  bedrock stocktake close <id>                               セッションを締める`

export default factory.createHandlers((c) => c.text(help))
