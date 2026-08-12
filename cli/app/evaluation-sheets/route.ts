import { factory } from "@/factory"

export const help = `bedrock evaluation-sheets — MBO 評価シート

usage:
  bedrock evaluation-sheets list [--period <p>] [--status <s>] [--employee-id <id>]   一覧（管理者のみ）
  bedrock evaluation-sheets mine [--period <p>] [--status <s>]                         自分の評価シート一覧
  bedrock evaluation-sheets show --id <sheet-id>                                       1件表示
  bedrock evaluation-sheets create --employee-id <id> --period <p> [--template-id <id>] [--primary-evaluator-id <id>] [--secondary-evaluator-id <id>]
  bedrock evaluation-sheets transition --id <sheet-id> --status <s> --expected-revision <n> [--note <text>]
  bedrock evaluation-sheets evaluators --id <sheet-id> --primary-evaluator-id <id> --expected-revision <n> [--secondary-evaluator-id <id>]

statuses:
  draft → pending_approval → approved → self_eval → primary_eval → secondary_eval → finalized → archived
  rejected（差し戻し）→ draft に戻る
  reopened（再開）→ self_eval に戻る`

export default factory.createHandlers((c) => c.text(help))
