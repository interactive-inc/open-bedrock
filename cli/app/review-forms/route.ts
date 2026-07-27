import { factory } from "@/factory"

export const help = `bedrock review-forms — 評価フォーム

usage:
  bedrock review-forms mine                                       自分の評価依頼一覧
  bedrock review-forms list --subject-employee-id <id> [--cycle-id <id>]  被評価者ごとのフォーム/提出状況
  bedrock review-forms bulk --cycle-id <id> --forms <file>        フォーム一括作成（360度・管理者）
  bedrock review-forms submit <form_id> --score <n> [--comment <c>]  評価送信`

export default factory.createHandlers((c) => c.text(help))
