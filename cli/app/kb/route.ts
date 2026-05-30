import { factory } from "@/factory"

export const help = `karte kb — ナレッジ

usage:
  karte kb search [q] [--category <c>]   ナレッジ検索
  karte kb get <id>                      ナレッジ詳細`

export default factory.createHandlers((c) => c.text(help))
