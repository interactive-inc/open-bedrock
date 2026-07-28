import { factory } from "@/factory"

export const help = `bedrock decision-records — 意思決定記録(ADR)

usage:
  bedrock decision-records list                                      意思決定記録の一覧
  bedrock decision-records show <id>                                 意思決定記録の詳細
  bedrock decision-records create --title <t> --decided-on <d> --context <c> --decision <dc> [--consequences <cq>]
  bedrock decision-records update <id> --title <t> --decided-on <d> --context <c> --decision <dc> [--consequences <cq>]
  bedrock decision-records supersede <id> --by <new_id>              後続の決定で supersede`

export default factory.createHandlers((c) => c.text(help))
