import { factory } from "@/factory"

export const help = `bedrock family-care-leave — 産休・育休・介護休業の申出

usage:
  bedrock family-care-leave request --kind <s> --start <date> --end <date> [--note <s>]
  bedrock family-care-leave mine
  bedrock family-care-leave show --id <family-care-leave-id>
  bedrock family-care-leave update --id <id> --kind <s> --start <date> --end <date> [--note <s>]
  bedrock family-care-leave cancel --id <family-care-leave-id>
  bedrock family-care-leave approve --id <family-care-leave-id>
  bedrock family-care-leave cancel-approval --id <family-care-leave-id>`

export default factory.createHandlers((c) => c.text(help))
