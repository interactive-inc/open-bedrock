import { factory } from "@/factory"

export const help = `bedrock certificate-requests — 証明書発行依頼

usage:
  bedrock certificate-requests request --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  bedrock certificate-requests mine
  bedrock certificate-requests show --id <certificate-request-id>
  bedrock certificate-requests update --id <id> --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  bedrock certificate-requests cancel --id <certificate-request-id>
  bedrock certificate-requests issue --id <certificate-request-id>
  bedrock certificate-requests reject --id <certificate-request-id>`

export default factory.createHandlers((c) => c.text(help))
