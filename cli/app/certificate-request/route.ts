import { factory } from "@/factory"

export const help = `karte certificate-request — 証明書発行依頼

usage:
  karte certificate-request request --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  karte certificate-request mine
  karte certificate-request show --id <certificate-request-id>
  karte certificate-request update --id <id> --type <s> [--submit-to <s>] [--needed-by <date>] [--note <s>]
  karte certificate-request cancel --id <certificate-request-id>
  karte certificate-request issue --id <certificate-request-id>
  karte certificate-request reject --id <certificate-request-id>`

export default factory.createHandlers((c) => c.text(help))
