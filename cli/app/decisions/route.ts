import { factory } from "@/factory"

export const help = `bedrock decisions — 意思決定記録(ADR)

usage:
  bedrock decisions list                                      意思決定記録の一覧
  bedrock decisions show <id>                                 意思決定記録の詳細
  bedrock decisions create --title <t> --decided-on <d> --context <c> --decision <dc> [--consequences <cq>]
  bedrock decisions update <id> --title <t> --decided-on <d> --context <c> --decision <dc> [--consequences <cq>]
  bedrock decisions supersede <id> --by <new_id>              後続の決定で supersede`

export default factory.createHandlers((c) => c.text(help))
