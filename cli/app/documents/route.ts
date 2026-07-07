import { factory } from "@/factory"

export const help = `karte documents — 文書台帳

usage:
  karte documents list [--category <c>]                         文書一覧（期限の近い順）
  karte documents register --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]
  karte documents update <id> --title <t> --location <l> [--category <c>] [--partner-code <p>] [--expires-on <d>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
