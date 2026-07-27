import { factory } from "@/factory"

export const help = `bedrock department-budgets — 部署予算

usage:
  bedrock department-budgets list [--department-id <n>] [--fiscal-period <p>]     予算一覧
  bedrock department-budgets show <id>                                            予算の詳細（消化額・残額）
  bedrock department-budgets summary --fiscal-period <p>                          部署ごとの消化状況
  bedrock department-budgets create --department-id <n> --fiscal-period <p> \\
    --period-start <d> --period-end <d> --amount <n> --name <s> [--note <m>]  予算を登録
  bedrock department-budgets update <id> --amount <n> --name <s> [--note <m>]     金額・名称・メモを修正
  bedrock department-budgets delete <id>                                          予算を削除`

export default factory.createHandlers((c) => c.text(help))
