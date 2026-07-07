import { factory } from "@/factory"

export const help = `karte it-incidents — インシデント記録

usage:
  karte it-incidents list [--status open|resolved]
  karte it-incidents create --occurred-at <t> --title <t> --summary <t> [--severity low|medium|high|critical]
  karte it-incidents resolve <id>`

export default factory.createHandlers((c) => c.text(help))
