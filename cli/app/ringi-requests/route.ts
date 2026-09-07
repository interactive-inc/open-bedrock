import { factory } from "@/factory"

export const help = `bedrock ringi-requests — 稟議

usage:
  bedrock ringi-requests submit --request-key <uuid> --approver-id <id> --title <t> --amount <n> --reason <r>  稟議を申請
  bedrock ringi-requests me [--status <s>]                           自分の稟議一覧
  bedrock ringi-requests inbox                                       承認待ち一覧
  bedrock ringi-requests approve <id> --decision-target '<json>' [--comment <c>]                稟議を承認
  bedrock ringi-requests reject <id> --decision-target '<json>' [--comment <c>]                   稟議を却下
  bedrock ringi-requests show <id>                                 内容と判断対象を確認
  bedrock ringi-requests cancel <id> --decision-target '<json>'      本人の稟議を取消
  bedrock ringi-requests execute <id> --decision-target '<json>'     決裁の確定を再試行
  bedrock ringi-procedures [--definition '<json>' --expected-revision <n>]  承認規程を参照・設定
  bedrock ringi-requests admin [--status <s>] [--applicant-id <id>] [--sort <s>] [--limit <n>] [--offset <n>]  全件参照`

export default factory.createHandlers((c) => c.text(help))
