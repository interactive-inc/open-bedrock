import { factory } from "@/factory"

export const help = `bedrock family-care-leaves — 産休・育休・介護休業の申出

usage:
  bedrock family-care-leaves request --kind <s> --start <date> --end <date> [--note <s>]
  bedrock family-care-leaves mine
  bedrock family-care-leaves show --id <family-care-leave-id>
  bedrock family-care-leaves update --id <id> --kind <s> --start <date> --end <date> [--note <s>]
  bedrock family-care-leaves cancel --id <family-care-leave-id>
  bedrock family-care-leaves approve --id <family-care-leave-id>
  bedrock family-care-leaves cancel-approval --id <family-care-leave-id>`

export default factory.createHandlers((c) => c.text(help))
