import { factory } from "@/factory"

export const help = `karte stocktake — 棚卸し

usage:
  karte stocktake list [--status open|closed]              セッション一覧
  karte stocktake start --name <n> --target-date <d>       セッション開始
  karte stocktake show <id>                                詳細（確認状況）
  karte stocktake check <id> --asset-code <c> [--location-note <m>]  現物確認を記録
  karte stocktake close <id>                               セッションを締める`

export default factory.createHandlers((c) => c.text(help))
