import { factory } from "@/factory"

export const help = `bedrock survey — アンケート

usage:
  bedrock survey list              オープン中のアンケート
  bedrock survey answer <id> --data <file>   回答
  bedrock survey summary <id>      集計`

export default factory.createHandlers((c) => c.text(help))
