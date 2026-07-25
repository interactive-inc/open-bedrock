import { factory } from "@/factory"

export const help = `bedrock certificate-request — 証明書発行依頼

usage:
  bedrock certificate-request request --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  bedrock certificate-request mine
  bedrock certificate-request show --id <certificate-request-id>
  bedrock certificate-request update --id <id> --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  bedrock certificate-request cancel --id <certificate-request-id>
  bedrock certificate-request issue --id <certificate-request-id>
  bedrock certificate-request reject --id <certificate-request-id>`

export default factory.createHandlers((c) => c.text(help))
