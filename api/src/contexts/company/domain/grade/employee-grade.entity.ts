import type { EmployeeGradeRow } from "@/contexts/company/infrastructure/schema/grade"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  gradeId: z.number(),
  effectiveDate: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 等級の割当履歴（社員ごとに、いつからどの等級か。事実の記録のみ）。集約ルート。 */
export class EmployeeGrade implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly gradeId!: Props["gradeId"]

  readonly effectiveDate!: Props["effectiveDate"]

  readonly reason!: Props["reason"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する等級割当を組み立てる。id は未採番。 */
  static create(props: {
    employeeId: number
    gradeId: number
    effectiveDate: string
    reason: string | null
    createdAt: string
  }): EmployeeGrade {
    return new EmployeeGrade({
      id: null,
      employeeId: props.employeeId,
      gradeId: props.gradeId,
      effectiveDate: props.effectiveDate,
      reason: props.reason,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: EmployeeGradeRow): EmployeeGrade {
    return new EmployeeGrade({
      id: row.id,
      employeeId: row.employeeId,
      gradeId: row.gradeId,
      effectiveDate: row.effectiveDate,
      reason: row.reason,
      createdAt: row.createdAt,
    })
  }
}
