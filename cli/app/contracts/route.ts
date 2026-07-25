import { factory } from "@/factory"

export const help = `bedrock contracts — 契約記録

usage:
  bedrock contracts list [--partner-id <id>] [--order renewal_near|contract_date_desc|contract_date_asc]
  bedrock contracts create --partner-id <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]
  bedrock contracts update <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]`

export default factory.createHandlers((c) => c.text(help))
