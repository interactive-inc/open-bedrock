import type { EmployeeEventRow } from "@/contexts/company-compatibility/infrastructure/schema/employee-event"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  kind: z.enum(["join", "transfer", "leave_of_absence", "return", "retire"]),
  effectiveDate: z.string(),
  fromDepartmentCode: z.string().nullable(),
  toDepartmentCode: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 異動・在籍イベント（入社・異動・休職・復職・退職。判定は持たず事実の記録のみ）。集約ルート。 */
export class EmployeeEvent implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly kind!: Props["kind"]

  readonly effectiveDate!: Props["effectiveDate"]

  readonly fromDepartmentCode!: Props["fromDepartmentCode"]

  readonly toDepartmentCode!: Props["toDepartmentCode"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する在籍イベントを組み立てる。id は未採番。 */
  static create(props: {
    employeeId: number
    kind: Props["kind"]
    effectiveDate: string
    fromDepartmentCode: string | null
    toDepartmentCode: string | null
    note: string | null
    createdAt: string
  }): EmployeeEvent {
    return new EmployeeEvent({
      id: null,
      employeeId: props.employeeId,
      kind: props.kind,
      effectiveDate: props.effectiveDate,
      fromDepartmentCode: props.fromDepartmentCode,
      toDepartmentCode: props.toDepartmentCode,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: EmployeeEventRow): EmployeeEvent {
    return new EmployeeEvent({
      id: row.id,
      employeeId: row.employeeId,
      kind: zProps.shape.kind.parse(row.kind),
      effectiveDate: row.effectiveDate,
      fromDepartmentCode: row.fromDepartmentCode,
      toDepartmentCode: row.toDepartmentCode,
      note: row.note,
      createdAt: row.createdAt,
    })
  }
}
