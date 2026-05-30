import { factory } from "@/factory"

export const help = `karte survey — アンケート

usage:
  karte survey list              オープン中のアンケート
  karte survey answer <id> --data <file>   回答
  karte survey summary <id>      集計`

export default factory.createHandlers((c) => c.text(help))
