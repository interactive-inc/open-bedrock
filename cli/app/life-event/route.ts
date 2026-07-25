import { factory } from "@/factory"

export const help = `bedrock life-event — ライフイベント届出

usage:
  bedrock life-event request --type <s> --date <date> [--detail <s>]
  bedrock life-event mine
  bedrock life-event show --id <life-event-id>
  bedrock life-event update --id <id> --type <s> --date <date> [--detail <s>]
  bedrock life-event cancel --id <life-event-id>
  bedrock life-event approve --id <life-event-id>
  bedrock life-event reject --id <life-event-id>`

export default factory.createHandlers((c) => c.text(help))
