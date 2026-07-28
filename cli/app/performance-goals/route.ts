import { factory } from "@/factory"

export const help = `bedrock performance-goals — MBO 目標・評価

usage:
  bedrock performance-goals list [--period <p>] [--employee-id <id>]      目標一覧（employee-id は数値ID）
  bedrock performance-goals tree [--period <p>]                            全社→部門→個人の目標ツリー
  bedrock performance-goals create --period <p> --title <t> [--kpi <k>] [--weight <n>] [--owner-type <t>] [--department-code <c>]
  bedrock performance-goals evaluate <id> --kind self|manager|final [--score <n>] [--comment <c>]`

export default factory.createHandlers((c) => c.text(help))
