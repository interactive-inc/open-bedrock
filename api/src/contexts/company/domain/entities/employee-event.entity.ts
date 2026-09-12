import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { z } from "zod"

const employeeEventPropsSchema = z.object({
  id: z.number().int(),
  employeeId: z.string().min(1).max(128),
  kind: z.string(),
  effectiveDate: z.string(),
  fromDepartmentCode: z.string().nullable(),
  toDepartmentCode: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

export type EmployeeEventProps = Omit<z.infer<typeof employeeEventPropsSchema>, "employeeId"> & {
  employeeId: EmployeeId
}

/** 旧人事注記の原記録。文字列を補正せず、確定した発令へ読み替えない。 */
export class EmployeeEventEntity {
  private static parse(props: unknown): EmployeeEventProps {
    const parsed = employeeEventPropsSchema.parse(props)
    return { ...parsed, employeeId: restoreWorkforceId("employee", parsed.employeeId) }
  }

  private constructor(private readonly props: EmployeeEventProps) {
    Object.freeze(this)
  }

  static restore(props: unknown): EmployeeEventEntity {
    return new EmployeeEventEntity(EmployeeEventEntity.parse(props))
  }

  toProps(): EmployeeEventProps {
    return this.props
  }
}
