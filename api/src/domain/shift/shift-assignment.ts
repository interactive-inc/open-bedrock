import type { ShiftAssignmentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  patternId: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  publishedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// シフト割当（社員ごとの日次シフト。publishedAt:null は下書き）。集約ルート。
export class ShiftAssignment implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly patternId!: Props["patternId"]

  readonly date!: Props["date"]

  readonly note!: Props["note"]

  readonly publishedAt!: Props["publishedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成する割当を組み立てる。id は未採番、未公開。
  static create(props: {
    employeeId: number
    patternId: number | null
    date: string
    note: string | null
  }): ShiftAssignment {
    return new ShiftAssignment({
      id: null,
      employeeId: props.employeeId,
      patternId: props.patternId,
      date: props.date,
      note: props.note,
      publishedAt: null,
    })
  }

  static fromRow(row: ShiftAssignmentRow): ShiftAssignment {
    return new ShiftAssignment({
      id: row.id,
      employeeId: row.employeeId,
      patternId: row.patternId,
      date: row.date,
      note: row.note,
      publishedAt: row.publishedAt,
    })
  }

  withPublished(publishedAt: string) {
    return new ShiftAssignment({ ...this.props, publishedAt })
  }

  // パターン・日付・備考を変更した新しい割当を返す。
  withDetails(props: {
    patternId: number | null
    date: string
    note: string | null
  }): ShiftAssignment {
    return new ShiftAssignment({
      ...this.props,
      patternId: props.patternId,
      date: props.date,
      note: props.note,
    })
  }
}
