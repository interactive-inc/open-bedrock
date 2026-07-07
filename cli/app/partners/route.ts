import { factory } from "@/factory"

export const help = `karte partners — 取引先台帳

usage:
  karte partners list [--q <keyword>] [--status active|archived]   取引先一覧
  karte partners show <code>                                       取引先詳細
  karte partners register --code <c> --name <n> [--category customer|supplier|other] [--corporate-number <cn>] [--note <t>]
  karte partners update <id> --name <n> [--category <c>] [--corporate-number <cn>] [--note <t>]
  karte partners archive <id>                                      取引先をアーカイブ`

export default factory.createHandlers((c) => c.text(help))
