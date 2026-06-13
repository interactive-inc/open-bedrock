import { factory } from "@/factory"

export const help = `karte goal — MBO 目標・評価

usage:
  karte goal list [--period <p>] [--employee-id <id>]      目標一覧（employee-id は数値ID）
  karte goal create --period <p> --title <t> [--kpi <k>] [--weight <n>]
  karte goal evaluate <id> --kind self|manager|final [--score <n>] [--comment <c>]`

export default factory.createHandlers((c) => c.text(help))
