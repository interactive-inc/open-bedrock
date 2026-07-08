import { factory } from "@/factory"

export const help = `karte budget — 部署予算

usage:
  karte budget list [--department-id <n>] [--fiscal-period <p>]     予算一覧
  karte budget show <id>                                            予算の詳細（消化額・残額）
  karte budget summary --fiscal-period <p>                          部署ごとの消化状況
  karte budget create --department-id <n> --fiscal-period <p> \\
    --period-start <d> --period-end <d> --amount <n> --name <s> [--note <m>]  予算を登録
  karte budget update <id> --amount <n> --name <s> [--note <m>]     金額・名称・メモを修正
  karte budget delete <id>                                          予算を削除`

export default factory.createHandlers((c) => c.text(help))
