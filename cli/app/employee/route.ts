import { factory } from "@/factory"

export const help = `bedrock employee — 社員関連

usage:
  bedrock employee search [--q <kw>] [--dept <name>] [--status <status>]
  bedrock employee show <code>
  bedrock employee register --code <code> --name <name> --hire-on <date> --email <email> --role <role> --password-stdin
  bedrock employee update <code> --name <name>
  bedrock employee state --code <code> [--as-of <date>]
  bedrock employee timeline --code <code> [--from <date>] [--to <date>]
  bedrock employee archive --code <code>`

export default factory.createHandlers((c) => c.text(help))
