import { factory } from "@/factory"

export const help = `bedrock one-on-ones — 1on1

usage:
  bedrock one-on-ones list                         1on1 履歴
  bedrock one-on-ones create --member-email <e> [--topics <t>] [--manager-note <n>] [--next-action <a>]`

export default factory.createHandlers((c) => c.text(help))
