import { factory } from "@/factory"

export const help = `bedrock job-openings — 採用の募集枠

usage:
  bedrock job-openings list [--status open|closed]                募集一覧
  bedrock job-openings create --title <t> [--department-code <c>] [--status open|closed] [--note <t>]
  bedrock job-openings update <id> --title <t> --status open|closed [--department-code <c>] [--note <t>]

  すべて recruitment:manage が必要（社外個人情報のため閲覧も公開しない）。`

export default factory.createHandlers((c) => c.text(help))
