import { factory } from "@/factory"

export const help = `karte minutes — 議事録

usage:
  karte minutes list <meeting_code>                         会議体配下の議事録一覧
  karte minutes show <id>                                   議事録詳細
  karte minutes add <meeting_code> --held-on <d> --title <t> --body <md> [--attendees <a>]
  karte minutes edit <id> --held-on <d> --title <t> --body <md> [--attendees <a>]`

export default factory.createHandlers((c) => c.text(help))
