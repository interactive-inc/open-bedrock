import { factory } from "@/factory"

export const help = `bedrock documents — 文書台帳

usage:
  bedrock documents list [--category <c>]                         文書一覧（期限の近い順）
  bedrock documents register --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]
  bedrock documents update <id> --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
