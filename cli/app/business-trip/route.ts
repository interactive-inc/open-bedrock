import { factory } from "@/factory"

export const help = `bedrock business-trip — 出張申請

usage:
  bedrock business-trip request --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  bedrock business-trip mine
  bedrock business-trip show --id <business-trip-id>
  bedrock business-trip update --id <id> --destination <s> --start <date> --end <date> --purpose <s> [--cost <n>]
  bedrock business-trip cancel --id <business-trip-id>
  bedrock business-trip approve --id <business-trip-id>
  bedrock business-trip reject --id <business-trip-id>`

export default factory.createHandlers((c) => c.text(help))
