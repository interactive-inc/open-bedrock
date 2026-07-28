import { factory } from "@/factory"

export const help = `bedrock employees — 社員関連

usage:
  bedrock employees search [--q <kw>] [--dept <name>] [--status <status>]
  bedrock employees show <code>
  bedrock employees register --code <code> --name <name> --hire-on <date> --email <email> --role <role> --password-stdin
  bedrock employees update <code> --name <name>
  bedrock employees state --code <code> [--as-of <date>]
  bedrock employees timeline --code <code> [--from <date>] [--to <date>]
  bedrock employees archive --code <code>`

export default factory.createHandlers((c) => c.text(help))
