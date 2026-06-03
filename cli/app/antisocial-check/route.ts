import { factory } from "@/factory"

export const help = `karte antisocial-check — 反社チェック申請

usage:
  karte antisocial-check request --partner <s> [--address <s>] [--representative <s>]
  karte antisocial-check mine
  karte antisocial-check show --id <antisocial-check-id>
  karte antisocial-check update --id <id> --partner <s> [--address <s>] [--representative <s>] [--result <s>]
  karte antisocial-check cancel --id <antisocial-check-id>`

export default factory.createHandlers((c) => c.text(help))
