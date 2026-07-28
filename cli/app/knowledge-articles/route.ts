import { factory } from "@/factory"

export const help = `bedrock knowledge-articles — ナレッジ

usage:
  bedrock knowledge-articles search [q] [--category <c>]   ナレッジ検索
  bedrock knowledge-articles get <id>                      ナレッジ詳細`

export default factory.createHandlers((c) => c.text(help))
