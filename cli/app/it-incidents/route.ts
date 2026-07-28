import { factory } from "@/factory"

export const help = `bedrock it-incidents — インシデント記録

usage:
  bedrock it-incidents list [--status open|resolved]
  bedrock it-incidents create --occurred-at <t> --title <t> --summary <t> [--severity low|medium|high|critical]
  bedrock it-incidents resolve <id>`

export default factory.createHandlers((c) => c.text(help))
