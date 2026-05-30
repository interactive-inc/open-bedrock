import { factory } from "@/factory"

export const help = `karte room — 会議室

usage:
  karte room avail --start <iso> --end <iso> [--capacity <n>]   空き状況
  karte room reserve --room-id <n> --start <iso> --end <iso> [--purpose <p>]`

export default factory.createHandlers((c) => c.text(help))
