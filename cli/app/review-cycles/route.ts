import { factory } from "@/factory"

export const help = `bedrock review-cycles — 評価サイクル

usage:
  bedrock review-cycles list                                      サイクル一覧
  bedrock review-cycles create --title <t> --period <p> [--due <d>]  サイクル作成（管理者）
  bedrock review-cycles update <cycle_id> [--title <t>] [--period <p>] [--due <d>]  サイクル更新（管理者）
  bedrock review-cycles open <cycle_id>                           サイクル開始（管理者）
  bedrock review-cycles close <cycle_id>                          サイクル締切（管理者）
  bedrock review-cycles policy <cycle_id> [--self] [--peer] [--manager]  評価方針の設定（管理者）
  bedrock review-cycles disclose --cycle-id <id>                  フォーム一括開示（管理者）
  bedrock review-cycles results <cycle_id> <employee_code>        結果確認（管理者）
  bedrock review-cycles delete <cycle_id>                         サイクル削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
