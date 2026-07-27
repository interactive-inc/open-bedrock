import { factory } from "@/factory"

export const help = `bedrock resignations — 退職申請

usage:
  bedrock resignations request --date <date> [--last <date>] [--reason <s>]
  bedrock resignations mine
  bedrock resignations show --id <resignation-id>
  bedrock resignations update --id <id> --date <date> [--last <date>] [--reason <s>]
  bedrock resignations cancel --id <resignation-id>
  bedrock resignations accept --id <resignation-id>
  bedrock resignations reject --id <resignation-id>`

export default factory.createHandlers((c) => c.text(help))
