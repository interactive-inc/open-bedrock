import { factory } from "@/factory"

export const help = `bedrock antisocial-checks — 反社チェック申請

usage:
  bedrock antisocial-checks request --partner <s> [--address <s>] [--representative <s>]
  bedrock antisocial-checks mine
  bedrock antisocial-checks show --id <antisocial-check-id>
  bedrock antisocial-checks update --id <id> --partner <s> [--address <s>] [--representative <s>] [--result <s>]
  bedrock antisocial-checks cancel --id <antisocial-check-id>`

export default factory.createHandlers((c) => c.text(help))
