import { factory } from "@/factory"

export const help = `bedrock employee-grades — 公開Companyの期間付き等級割当

  bedrock employee-grades list --organization-id <id> --employee-id <id> [--as-of <date>]
  bedrock employee-grades create --data <confirmed-grade-assignment.json> --idempotency-key <key>`

export default factory.createHandlers((c) => c.text(help))
