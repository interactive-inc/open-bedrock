import { factory } from "@/factory"
export const help = `bedrock expenses — 経費の申請と社内承認

  upload-attachment <path>                                  添付を預けてIDを取得
  submit --request-key <uuid> --category <c> --amount <n> --spent-at <d> [--note <m>] [--attachment-id <id>]...
  submit ... --existing-expense-id <id>                      旧経費を確認して接続
  submit ... --previous-expense-id <id>                      差戻し元から修正して提出
  mine [--status <s>]                                       自分の経費
  inbox [--limit <n>] [--offset <n>]                         現在の判断・確定待ち
  show <id>                                                内容とdecision_targetを確認
  approve <id> --decision-target '<json>' [--comment <c>]     確認した対象へ承認
  reject <id> --decision-target '<json>' [--comment <c>]      確認した対象へ否認
  cancel <id> --decision-target '<json>'                     履歴を残して取消
  execute <id> --decision-target '<json>'                    決裁確定の再試行

承認規程: bedrock expense-procedures --help
再送時は同じrequest-key・内容・attachment-idを指定してください。`
export default factory.createHandlers((c) => c.text(help))
