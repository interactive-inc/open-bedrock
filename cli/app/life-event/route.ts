import { factory } from "@/factory"

export const help = `karte life-event — ライフイベント届出

usage:
  karte life-event request --type <s> --date <date> [--detail <s>]
  karte life-event mine
  karte life-event show --id <life-event-id>
  karte life-event update --id <id> --type <s> --date <date> [--detail <s>]
  karte life-event cancel --id <life-event-id>
  karte life-event approve --id <life-event-id>
  karte life-event reject --id <life-event-id>`

export default factory.createHandlers((c) => c.text(help))
