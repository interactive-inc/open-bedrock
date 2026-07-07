import { factory } from "@/factory"

export const help = `karte goal — MBO 目標・評価

usage:
  karte goal list [--period <p>] [--employee-id <id>]      目標一覧（employee-id は数値ID）
  karte goal tree [--period <p>]                            全社→部門→個人の目標ツリー
  karte goal create --period <p> --title <t> [--kpi <k>] [--weight <n>] [--owner-type <t>] [--department-code <c>]
  karte goal evaluate <id> --kind self|manager|final [--score <n>] [--comment <c>]`

export default factory.createHandlers((c) => c.text(help))
