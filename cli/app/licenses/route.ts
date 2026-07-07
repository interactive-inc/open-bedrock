import { factory } from "@/factory"

export const help = `karte licenses — ライセンス・SaaS 台帳

usage:
  karte licenses list [--status active|cancelled]
  karte licenses create --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  karte licenses update <id> --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  karte licenses cancel <id>`

export default factory.createHandlers((c) => c.text(help))
