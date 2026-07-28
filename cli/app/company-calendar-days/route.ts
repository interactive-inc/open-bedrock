import { factory } from "@/factory"

export const help = `bedrock company-calendar-days — 会社カレンダー（会社休日・振替出勤日）

usage:
  bedrock company-calendar-days list [--year <YYYY>]                   会社カレンダー一覧（全認証者）
  bedrock company-calendar-days add --date <YYYY-MM-DD> --kind <holiday|workday> [--name <n>]   (calendar:manage)
  bedrock company-calendar-days delete --id <calendar-day-id>          (calendar:manage)`

export default factory.createHandlers((c) => c.text(help))
