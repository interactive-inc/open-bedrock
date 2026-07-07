import { factory } from "@/factory"

export const help = `karte budgets — 予算枠

usage:
  karte budgets list [--fiscal-year <y>] [--department-code <c>]
  karte budgets create --fiscal-year <y> --title <t> --amount <n> [--department-code <c>] [--note <t>]
  karte budgets update <id> --fiscal-year <y> --title <t> --amount <n> [--department-code <c>] [--note <t>]
  karte budgets consume <id> --amount <n> --recorded-on <d> [--note <t>]`

export default factory.createHandlers((c) => c.text(help))
