import { factory } from "@/factory"

export const help = `bedrock surveys — アンケート

usage:
  bedrock surveys list              オープン中のアンケート
  bedrock surveys answer <id> --data <file>   回答
  bedrock surveys summary <id>      集計`

export default factory.createHandlers((c) => c.text(help))
