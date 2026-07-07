import { factory } from "@/factory"

export const help = `karte resignation — 退職申請

usage:
  karte resignation request --date <date> [--last <date>] [--reason <s>]
  karte resignation mine
  karte resignation show --id <resignation-id>
  karte resignation update --id <id> --date <date> [--last <date>] [--reason <s>]
  karte resignation cancel --id <resignation-id>
  karte resignation accept --id <resignation-id>
  karte resignation reject --id <resignation-id>`

export default factory.createHandlers((c) => c.text(help))
