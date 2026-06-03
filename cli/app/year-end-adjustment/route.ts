import { factory } from "@/factory"

export const help = `karte year-end-adjustment — 年末調整の申告

usage:
  karte year-end-adjustment request --year <n> [--note <s>]
  karte year-end-adjustment mine
  karte year-end-adjustment show --id <year-end-adjustment-id>
  karte year-end-adjustment update --id <id> --year <n> [--note <s>]
  karte year-end-adjustment cancel --id <year-end-adjustment-id>`

export default factory.createHandlers((c) => c.text(help))
