import { factory } from "@/factory"

export const help = `karte app — 申請ワークフロー

usage:
  karte app templates [--category <c>]    申請テンプレート一覧
  karte app template <code>               申請テンプレート詳細
  karte app submit <code> --data <file>   申請を提出
  karte app inbox                         自分宛の承認待ち一覧
  karte app mine [--status <s>]           自分の申請一覧
  karte app show <id>                     申請の詳細
  karte app approve <id> [--comment <c>]  申請を承認
  karte app reject <id> --comment <c>     申請を却下`

export default factory.createHandlers((c) => c.text(help))
