import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { z } from "zod"

const employeeGradePropsSchema = z.object({
  id: z.number().int().positive().nullable(),
  employeeId: z.string().min(1).max(128),
  gradeId: z.number().int().positive(),
  effectiveDate: z.string().date(),
  reason: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
})

export type EmployeeGradeProps = Omit<z.infer<typeof employeeGradePropsSchema>, "employeeId"> & {
  employeeId: EmployeeId
}

/** 従業員への等級付与という履歴事実。 */
export class EmployeeGradeEntity {
  private static parse(props: unknown): EmployeeGradeProps {
    const parsed = employeeGradePropsSchema.parse(props)
    return { ...parsed, employeeId: restoreWorkforceId("employee", parsed.employeeId) }
  }

  private constructor(private readonly props: EmployeeGradeProps) {
    Object.freeze(this)
  }

  static create(props: Omit<EmployeeGradeProps, "id">): EmployeeGradeEntity {
    return new EmployeeGradeEntity(EmployeeGradeEntity.parse({ ...props, id: null }))
  }

  static restore(props: unknown): EmployeeGradeEntity {
    return new EmployeeGradeEntity(EmployeeGradeEntity.parse(props))
  }

  toProps(): EmployeeGradeProps {
    return this.props
  }
}
