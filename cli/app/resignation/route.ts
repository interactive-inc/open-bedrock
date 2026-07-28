import { factory } from "@/factory"

export const help = `bedrock resignation — 退職申請

usage:
  bedrock resignation request --date <date> [--last <date>] [--reason <s>]
  bedrock resignation mine
  bedrock resignation show --id <resignation-id>
  bedrock resignation update --id <id> --date <date> [--last <date>] [--reason <s>]
  bedrock resignation cancel --id <resignation-id>
  bedrock resignation accept --id <resignation-id>
  bedrock resignation reject --id <resignation-id>`

export default factory.createHandlers((c) => c.text(help))
