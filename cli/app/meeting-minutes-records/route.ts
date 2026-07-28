import { factory } from "@/factory"

export const help = `bedrock meeting-minutes-records — 議事録

usage:
  bedrock meeting-minutes-records list <meeting_code>                         会議体配下の議事録一覧
  bedrock meeting-minutes-records show <id>                                   議事録詳細
  bedrock meeting-minutes-records add <meeting_code> --held-on <d> --title <t> --body <md> [--attendees <a>]
  bedrock meeting-minutes-records edit <id> --held-on <d> --title <t> --body <md> [--attendees <a>]`

export default factory.createHandlers((c) => c.text(help))
