import { factory } from "@/factory"

export const help = `karte contracts — 契約記録

usage:
  karte contracts list [--partner-id <id>] [--order renewal_near|contract_date_desc|contract_date_asc]
  karte contracts create --partner-id <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]
  karte contracts update <id> --title <t> --contract-date <d> [--starts-on <d>] [--ends-on <d>] [--renewal-deadline <d>] [--note <t>]`

export default factory.createHandlers((c) => c.text(help))
