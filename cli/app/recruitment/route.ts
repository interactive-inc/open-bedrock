import { factory } from "@/factory"

export const help = `karte recruitment — 採用(応募者管理)

usage:
  karte recruitment positions [--status open|closed]                募集一覧
  karte recruitment position-create --title <t> [--department-code <c>] [--status open|closed] [--note <t>]
  karte recruitment position-update <id> --title <t> --status open|closed [--department-code <c>] [--note <t>]
  karte recruitment candidates <position_id>                         応募者一覧
  karte recruitment candidate-add <position_id> --name <n> [--email <e>] [--source <s>] [--note <t>]
  karte recruitment advance <candidate_id> --stage screening|interview|offer|hired|rejected

  すべて recruitment:manage が必要（社外個人情報のため閲覧も公開しない）。`

export default factory.createHandlers((c) => c.text(help))
