import type { FamilyCareLeaveRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  employeeId: z.number(),
  leaveKind: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 産休・育休・介護休業の申出（種別・期間・備考の記録。給付金額の計算や判定は持たず記録のみ）。集約ルート。
export class FamilyCareLeave implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly leaveKind!: Props["leaveKind"]

  readonly startDate!: Props["startDate"]

  readonly endDate!: Props["endDate"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の休業申出を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。
  static create(props: {
    employeeId: number
    leaveKind: string
    startDate: string
    endDate: string
    note: string | null
    createdAt: string
  }): FamilyCareLeave {
    return new FamilyCareLeave({
      id: crypto.randomUUID(),
      employeeId: props.employeeId,
      leaveKind: props.leaveKind,
      startDate: props.startDate,
      endDate: props.endDate,
      note: props.note,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: FamilyCareLeaveRow): FamilyCareLeave {
    return new FamilyCareLeave({
      id: row.id,
      employeeId: row.employeeId,
      leaveKind: row.leaveKind,
      startDate: row.startDate,
      endDate: row.endDate,
      note: row.note,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  // 申出内容を変更した新しい休業申出を返す。
  withDetails(props: {
    leaveKind: string
    startDate: string
    endDate: string
    note: string | null
  }): FamilyCareLeave {
    return new FamilyCareLeave({
      ...this.props,
      leaveKind: props.leaveKind,
      startDate: props.startDate,
      endDate: props.endDate,
      note: props.note,
    })
  }
}
