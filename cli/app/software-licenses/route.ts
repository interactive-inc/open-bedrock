import { factory } from "@/factory"

export const help = `bedrock software-licenses — サービスの契約・プラン・利用者台帳

usage:
  bedrock software-licenses list [--status active|cancelled] [--limit 1..100] [--offset 0..100000]
  bedrock software-licenses get <id>
  bedrock software-licenses history <id> [--offset 0..100000]
  bedrock software-licenses create --name <n> --idempotency-key <key> [--plan-name <plan>] [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock software-licenses update <id> --name <n> --expected-revision <revision> [--plan-name <plan> | --clear-plan] [--vendor <v>] [--category saas|software|other] [--seats <n>] [--renewal-deadline <d>] [--owner-employee-id <id>] [--note <t>]
  bedrock software-licenses cancel <id> --expected-revision <revision>
  bedrock software-licenses assignments [--license-id <id>] [--employee-id <id>] [--state assigned|released] [--limit 1..100] [--offset 0..100000]
  bedrock software-licenses assign <id> --assignment-id <uuid> --employee-id <id> --reason <text> [--account-reference <reference>]
  bedrock software-licenses release <assignment-id> --reason <text>

登録の再送には同じキー、割当の再送には同じUUIDを使います。
更新・解約にはgetで確認したrevisionを指定します。競合時に最新版へ自動で差し替えません。
書込は在籍する人間の資格を要求します。外部サービスの購入・解約・権限操作は行いません。`

export default factory.createHandlers((c) => c.text(help))
