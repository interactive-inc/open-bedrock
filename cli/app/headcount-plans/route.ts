import { factory } from "@/factory"

export const help = `karte headcount-plans — 人員計画(計画と実績の比較)

usage:
  karte headcount-plans list [--fiscal-year <y>]                    人員計画一覧(実在籍数つき。headcount_plan:read:all)
  karte headcount-plans create --fiscal-year <y> --planned-count <n> [--department-code <c>] [--note <t>]
  karte headcount-plans update <id> --planned-count <n> [--note <t>]

  create/update は headcount_plan:manage が必要。`

export default factory.createHandlers((c) => c.text(help))
