import { factory } from "@/factory"

export const help = `bedrock minutes — 議事録

usage:
  bedrock minutes list <meeting_code>                         会議体配下の議事録一覧
  bedrock minutes show <id>                                   議事録詳細
  bedrock minutes add <meeting_code> --held-on <d> --title <t> --body <md> [--attendees <a>]
  bedrock minutes edit <id> --held-on <d> --title <t> --body <md> [--attendees <a>]`

export default factory.createHandlers((c) => c.text(help))
