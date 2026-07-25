import { factory } from "@/factory"

export const help = `bedrock 1on1 — 1on1

usage:
  bedrock 1on1 list                         1on1 履歴
  bedrock 1on1 create --member-email <e> [--topics <t>] [--manager-note <n>] [--next-action <a>]`

export default factory.createHandlers((c) => c.text(help))
