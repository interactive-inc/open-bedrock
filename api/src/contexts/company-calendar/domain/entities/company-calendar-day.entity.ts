import type { CompanyCalendarDayRow } from "@/contexts/company-calendar/infrastructure/schema/company-calendar"
import { calendarDayKindSchema } from "@/contexts/company-calendar/domain/definitions/calendar-day-kind.definition"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  calendarDate: z.string(),
  kind: calendarDayKindSchema,
  name: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 会社カレンダーの 1 日（会社休日 / 振替出勤日の記録）。通常営業日は行を持たず、判定・計算は持たない。 */
export class CompanyCalendarDay implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly calendarDate!: Props["calendarDate"]

  readonly kind!: Props["kind"]

  readonly name!: Props["name"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する会社カレンダーの 1 日を組み立てる。id は未採番。 */
  static create(props: {
    calendarDate: string
    kind: Props["kind"]
    name: string | null
    createdAt: string
  }): CompanyCalendarDay {
    return new CompanyCalendarDay({
      id: null,
      calendarDate: props.calendarDate,
      kind: props.kind,
      name: props.name,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: CompanyCalendarDayRow): CompanyCalendarDay {
    return new CompanyCalendarDay({
      id: row.id,
      calendarDate: row.calendarDate,
      kind: row.kind,
      name: row.name,
      createdAt: row.createdAt,
    })
  }
}
