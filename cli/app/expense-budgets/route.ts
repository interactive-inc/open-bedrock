import { factory } from "@/factory"

export const help = `bedrock expense-budgets — 部署予算

usage:
  bedrock expense-budgets list [--department-id <n>] [--fiscal-period <p>]     予算一覧
  bedrock expense-budgets show <id>                                            予算の詳細（消化額・残額）
  bedrock expense-budgets summary --fiscal-period <p>                          部署ごとの消化状況
  bedrock expense-budgets create --department-id <n> --fiscal-period <p> \\
    --period-start <d> --period-end <d> --amount <n> --name <s> [--note <m>]  予算を登録
  bedrock expense-budgets update <id> --amount <n> --name <s> [--note <m>]     金額・名称・メモを修正
  bedrock expense-budgets delete <id>                                          予算を削除`

export default factory.createHandlers((c) => c.text(help))
