import { factory } from "@/factory"

export const help = `bedrock kb — ナレッジ

usage:
  bedrock kb search [q] [--category <c>]   ナレッジ検索
  bedrock kb get <id>                      ナレッジ詳細`

export default factory.createHandlers((c) => c.text(help))
