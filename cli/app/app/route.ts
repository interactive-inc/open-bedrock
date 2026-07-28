import { factory } from "@/factory"

export const help = `bedrock app — 申請ワークフロー

usage:
  bedrock app templates [--category <c>]    申請テンプレート一覧
  bedrock app template <code>               申請テンプレート詳細
  bedrock app submit <code> --data <file>   申請を提出
  bedrock app inbox                         自分宛の承認待ち一覧
  bedrock app mine [--status <s>]           自分の申請一覧
  bedrock app show <id>                     申請の詳細
  bedrock app approve <id> [--comment <c>]  申請を承認
  bedrock app reject <id> --comment <c>     申請を却下
  bedrock app workflow-repair list          修復が必要な承認フロー一覧
  bedrock app workflow-repair reassign <id> --candidates <ids> --reason <text>
                                          承認候補を再割当`

export default factory.createHandlers((c) => c.text(help))
