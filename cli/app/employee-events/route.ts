import { factory } from "@/factory"

export const help = `karte employee-events — 異動・在籍イベント履歴

usage:
  karte employee-events list [--employee-id <id>] [--kind <k>]   本人 or 全社閲覧権限
  karte employee-events record --employee-id <id> --kind join|transfer|leave_of_absence|return|retire --effective-date <YYYY-MM-DD> [--from <code>] [--to <code>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
