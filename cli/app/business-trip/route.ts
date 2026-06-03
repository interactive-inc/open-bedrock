import { factory } from "@/factory"

export const help = `karte business-trip — 出張申請

usage:
  karte business-trip request --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  karte business-trip mine
  karte business-trip show --id <business-trip-id>
  karte business-trip update --id <id> --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  karte business-trip cancel --id <business-trip-id>`

export default factory.createHandlers((c) => c.text(help))
