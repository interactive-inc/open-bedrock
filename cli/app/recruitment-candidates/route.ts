import { factory } from "@/factory"

export const help = `bedrock recruitment-candidates — 採用の応募者

usage:
  bedrock recruitment-candidates list <job_opening_id>            応募者一覧
  bedrock recruitment-candidates create <job_opening_id> --name <n> [--email <e>] [--source <s>] [--note <t>]
  bedrock recruitment-candidates advance <candidate_id> --stage screening|interview|offer|hired|rejected

  すべて recruitment:manage が必要（社外個人情報のため閲覧も公開しない）。`

export default factory.createHandlers((c) => c.text(help))
