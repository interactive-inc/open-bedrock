import { factory } from "@/factory"

export const help = `bedrock business-trips — 出張申請

usage:
  bedrock business-trips request --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  bedrock business-trips mine
  bedrock business-trips show --id <business-trip-id>
  bedrock business-trips update --id <id> --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  bedrock business-trips cancel --id <business-trip-id>
  bedrock business-trips approve --id <business-trip-id>
  bedrock business-trips reject --id <business-trip-id>`

export default factory.createHandlers((c) => c.text(help))
