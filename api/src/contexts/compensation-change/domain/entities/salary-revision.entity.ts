import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { SalaryRevisionRow } from "@/contexts/compensation-change/infrastructure/schema/compensation-change"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: zEmployeeId,
  effectiveDate: z.string(),
  previousBaseSalary: z.number().int(),
  newBaseSalary: z.number().int(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 給与改定の事実記録。基本給・前回基本給・適用日のみ持ち、計算や査定判定はしない。最機微。 */
export class SalaryRevision implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly effectiveDate!: Props["effectiveDate"]

  readonly previousBaseSalary!: Props["previousBaseSalary"]

  readonly newBaseSalary!: Props["newBaseSalary"]

  readonly reason!: Props["reason"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規の給与改定記録を組み立てる。id は未採番。 */
  static create(props: {
    employeeId: EmployeeId
    effectiveDate: string
    previousBaseSalary: number
    newBaseSalary: number
    reason: string | null
    createdAt: string
  }): SalaryRevision {
    return new SalaryRevision({
      id: null,
      employeeId: props.employeeId,
      effectiveDate: props.effectiveDate,
      previousBaseSalary: props.previousBaseSalary,
      newBaseSalary: props.newBaseSalary,
      reason: props.reason,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: SalaryRevisionRow): SalaryRevision {
    return new SalaryRevision({
      id: row.id,
      employeeId: row.employeeId,
      effectiveDate: row.effectiveDate,
      previousBaseSalary: row.previousBaseSalary,
      newBaseSalary: row.newBaseSalary,
      reason: row.reason,
      createdAt: row.createdAt,
    })
  }
}
