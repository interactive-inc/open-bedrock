import { factory } from "@/factory"

export const help = `bedrock partners — 取引先台帳

usage:
  bedrock partners list [--q <keyword>] [--status active|archived]   取引先一覧
  bedrock partners show <code>                                       取引先詳細
  bedrock partners register --code <c> --name <n> [--category customer|supplier|other] [--corporate-number <cn>] [--note <t>]
  bedrock partners update <id> --name <n> [--category <c>] [--corporate-number <cn>] [--note <t>]
  bedrock partners archive <id>                                      取引先をアーカイブ`

export default factory.createHandlers((c) => c.text(help))
