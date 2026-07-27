import { factory } from "@/factory"

export const help = `bedrock software-licenses — ライセンス・SaaS 台帳

usage:
  bedrock software-licenses list [--status active|cancelled]
  bedrock software-licenses create --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock software-licenses update <id> --name <n> [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock software-licenses cancel <id>`

export default factory.createHandlers((c) => c.text(help))
