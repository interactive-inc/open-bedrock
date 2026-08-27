import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { FamilyCareLeaveRow } from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  employeeId: zEmployeeId,
  leaveKind: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().nullable(),
  status: z.enum(["requested", "approved", "cancelled"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 産休・育休・介護休業の申出（種別・期間・備考の記録。給付金額の計算や判定は持たず記録のみ）。集約ルート。 */
export class FamilyCareLeave implements Props {
  /** id は UUID。新規作成時に採番する。 */
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

  /** 新規の休業申出を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。 */
  static create(props: {
    employeeId: EmployeeId
    leaveKind: string
    startDate: string
    endDate: string
    note: string | null
    createdAt: string
  }): FamilyCareLeave | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

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
      status: zProps.shape.status.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 申出内容を変更した新しい休業申出を返す。 */
  withDetails(props: {
    leaveKind: string
    startDate: string
    endDate: string
    note: string | null
  }): FamilyCareLeave | { reason: "invalid_date_range" } {
    if (props.startDate > props.endDate) {
      return { reason: "invalid_date_range" }
    }

    return new FamilyCareLeave({
      ...this.props,
      leaveKind: props.leaveKind,
      startDate: props.startDate,
      endDate: props.endDate,
      note: props.note,
    })
  }

  /** requested のときだけ approved へ進めた新しい休業申出を返す。それ以外は遷移不可を返す。 */
  withApproved(): FamilyCareLeave | { reason: "invalid_transition" } {
    if (this.status !== "requested") {
      return { reason: "invalid_transition" }
    }

    return new FamilyCareLeave({ ...this.props, status: "approved" })
  }

  /** requested のときだけ cancelled へ進めた新しい休業申出を返す。それ以外は遷移不可を返す。 */
  withCancelled(): FamilyCareLeave | { reason: "invalid_transition" } {
    if (this.status !== "requested") {
      return { reason: "invalid_transition" }
    }

    return new FamilyCareLeave({ ...this.props, status: "cancelled" })
  }
}
