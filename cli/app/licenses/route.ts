import { factory } from "@/factory"

export const help = `bedrock licenses — ライセンス・SaaS 台帳

usage:
  bedrock licenses list [--status active|cancelled]
  bedrock licenses create --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock licenses update <id> --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock licenses cancel <id>`

export default factory.createHandlers((c) => c.text(help))
