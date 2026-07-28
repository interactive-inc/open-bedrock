import { factory } from "@/factory"

export const help = `bedrock review — 多面評価（レビューサイクル）

usage:
  bedrock review cycles                                          サイクル一覧
  bedrock review mine                                            自分の評価依頼一覧
  bedrock review forms --subject-employee-id <id> [--cycle-id <id>]  被評価者ごとのフォーム/提出状況
  bedrock review forms-bulk --cycle-id <id> --forms <file>       フォーム一括作成（360度・管理者）
  bedrock review disclose --cycle-id <id>                        フォーム一括開示（管理者）
  bedrock review submit <form_id> --score <n> [--comment <c>]    評価送信
  bedrock review results <cycle_id> <employee_code>              結果確認（管理者）
  bedrock review cycle create --title <t> --period <p> [--due <d>] サイクル作成（管理者）`

export default factory.createHandlers((c) => c.text(help))
