import { factory } from "@/factory"

export const help = `karte employee — 社員関連

usage:
  karte employee search [--q <kw>] [--dept <name>] [--status <status>]`

export default factory.createHandlers((c) => c.text(help))
