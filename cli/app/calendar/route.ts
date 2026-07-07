import { factory } from "@/factory"

export const help = `karte calendar — 会社カレンダー（会社休日・振替出勤日）

usage:
  karte calendar list [--year <YYYY>]                   会社カレンダー一覧（全認証者）
  karte calendar add --date <YYYY-MM-DD> --kind <holiday|workday> [--name <n>]   (calendar:manage)
  karte calendar delete --id <calendar-day-id>          (calendar:manage)`

export default factory.createHandlers((c) => c.text(help))
