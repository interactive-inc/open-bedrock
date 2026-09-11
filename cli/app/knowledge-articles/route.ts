import { factory } from "@/factory"

export const help = `bedrock knowledge-articles — ナレッジ

usage:
  bedrock knowledge-articles search [q] [--category <c>]   ナレッジ検索
  bedrock knowledge-articles get <id>                      ナレッジ詳細
  bedrock knowledge-articles history --id <id>             改訂履歴
  bedrock knowledge-articles add --help                    作成の入力条件
  bedrock knowledge-articles edit --help                   更新の入力条件
  bedrock knowledge-articles withdraw --help               取下げの入力条件`

export default factory.createHandlers((c) => c.text(help))
