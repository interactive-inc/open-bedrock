import type { AttendanceRecordRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  workDate: z.string(),
  clockInAt: z.string().nullable(),
  clockOutAt: z.string().nullable(),
  workMinutes: z.number().nullable(),
  note: z.string().nullable(),
  status: z.string(),
})

type Props = z.infer<typeof zProps>

// 勤怠記録の集約ルート。出勤(open)から退勤(closed)で労働時間が確定する。
export class AttendanceRecord implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly workDate!: Props["workDate"]

  readonly clockInAt!: Props["clockInAt"]

  readonly clockOutAt!: Props["clockOutAt"]

  readonly workMinutes!: Props["workMinutes"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 出勤打刻で新規の勤怠記録を組み立てる。workDate は打刻時刻の日付部分、初期状態は open。
  static create(props: {
    employeeId: number
    clockInAt: string
    note: string | null
  }): AttendanceRecord {
    return new AttendanceRecord({
      id: null,
      employeeId: props.employeeId,
      workDate: props.clockInAt.slice(0, 10),
      clockInAt: props.clockInAt,
      clockOutAt: null,
      workMinutes: null,
      note: props.note,
      status: "open",
    })
  }

  // 永続化された行から復元する。
  static fromRow(row: AttendanceRecordRow): AttendanceRecord {
    return new AttendanceRecord({
      id: row.id,
      employeeId: row.employeeId,
      workDate: row.workDate,
      clockInAt: row.clockInAt,
      clockOutAt: row.clockOutAt,
      workMinutes: row.workMinutes,
      note: row.note,
      status: row.status,
    })
  }

  // 退勤打刻で労働時間を確定し閉じる。note が渡されれば上書きする。
  withClosed(props: { clockOutAt: string; workMinutes: number; note?: string | null }) {
    return new AttendanceRecord({
      ...this.props,
      clockOutAt: props.clockOutAt,
      workMinutes: props.workMinutes,
      note: props.note !== undefined ? props.note : this.props.note,
      status: "closed",
    })
  }
}
