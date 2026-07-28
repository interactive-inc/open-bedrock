import { factory } from "@/factory"

export const help = `bedrock partner-contracts — 契約記録

usage:
  bedrock partner-contracts list [--partner-id <id>] [--order renewal_near|contract_date_desc|contract_date_asc]
  bedrock partner-contracts create --partner-id <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]
  bedrock partner-contracts update <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]`

export default factory.createHandlers((c) => c.text(help))
