import { factory } from "@/factory"

export const help = `bedrock document-ledger-entries — 文書台帳

usage:
  bedrock document-ledger-entries list [--category <c>]                         文書一覧（期限の近い順）
  bedrock document-ledger-entries register --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]
  bedrock document-ledger-entries update <id> --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
