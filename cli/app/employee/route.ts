import { factory } from "@/factory"

export const help = `karte employee — 社員関連

usage:
  karte employee search [--q <kw>] [--dept <name>] [--status <status>]
  karte employee show <code>
  karte employee register --code <code> --name <name> --hire-on <date> --email <email> --role <role> --password-stdin
  karte employee update <code> --name <name>
  karte employee state --code <code> [--as-of <date>]
  karte employee timeline --code <code> [--from <date>] [--to <date>]
  karte employee archive --code <code>`

export default factory.createHandlers((c) => c.text(help))
