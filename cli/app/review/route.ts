import { factory } from "@/factory"

export const help = `karte review — 多面評価（レビューサイクル）

usage:
  karte review cycles                                          サイクル一覧
  karte review mine                                            自分の評価依頼一覧
  karte review forms --subject-employee-id <id> [--cycle-id <id>]  被評価者ごとのフォーム/提出状況
  karte review forms-bulk --cycle-id <id> --forms <file>       フォーム一括作成（360度・管理者）
  karte review disclose --cycle-id <id>                        フォーム一括開示（管理者）
  karte review submit <form_id> --score <n> [--comment <c>]    評価送信
  karte review results <cycle_id> <employee_code>              結果確認（管理者）
  karte review cycle create --title <t> --period <p> [--due <d>] サイクル作成（管理者）`

export default factory.createHandlers((c) => c.text(help))
