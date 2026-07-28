import { factory } from "@/factory"

export const help = `bedrock shift-swap-requests — シフト交代申請

usage:
  bedrock shift-swap-requests mine                                自分の交代申請一覧
  bedrock shift-swap-requests show <id>                           交代申請の詳細
  bedrock shift-swap-requests create --target-employee-code <c> --date <date> [--note <n>]  交代申請
  bedrock shift-swap-requests approve <id>                        交代承認
  bedrock shift-swap-requests cancel <id>                         交代申請の取下げ`

export default factory.createHandlers((c) => c.text(help))
