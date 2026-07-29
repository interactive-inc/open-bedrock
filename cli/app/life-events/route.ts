import { factory } from "@/factory"

export const help = `bedrock life-events — ライフイベント届出

usage:
  bedrock life-events request --type <type> --date <date> [--detail <s>]
                                                                        --type: marriage|divorce|childbirth|relocation|dependent_added|dependent_removed
  bedrock life-events mine
  bedrock life-events show --id <life-event-id>
  bedrock life-events update --id <id> --type <s> --date <date> [--detail <s>]
  bedrock life-events cancel --id <life-event-id>
  bedrock life-events approve --id <life-event-id>
  bedrock life-events reject --id <life-event-id>`

export default factory.createHandlers((c) => c.text(help))
