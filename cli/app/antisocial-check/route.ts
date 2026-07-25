import { factory } from "@/factory"

export const help = `bedrock antisocial-check — 反社チェック申請

usage:
  bedrock antisocial-check request --partner <s> [--address <s>] [--representative <s>]
  bedrock antisocial-check mine
  bedrock antisocial-check show --id <antisocial-check-id>
  bedrock antisocial-check update --id <id> --partner <s> [--address <s>] [--representative <s>] [--result <s>]
  bedrock antisocial-check cancel --id <antisocial-check-id>`

export default factory.createHandlers((c) => c.text(help))
