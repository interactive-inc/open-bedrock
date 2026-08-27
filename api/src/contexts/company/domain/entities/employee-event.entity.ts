import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { z } from "zod"

const employeeEventPropsSchema = z.object({
  id: z.number().int().positive().nullable(),
  employeeId: z.string().min(1).max(128),
  kind: z.enum(["join", "transfer", "leave_of_absence", "return", "retire"]),
  effectiveDate: z.string().date(),
  fromDepartmentCode: z.string().trim().min(1).max(64).nullable(),
  toDepartmentCode: z.string().trim().min(1).max(64).nullable(),
  note: z.string().trim().min(1).max(3_000).nullable(),
  createdAt: z.string().datetime(),
})

export type EmployeeEventProps = Omit<z.infer<typeof employeeEventPropsSchema>, "employeeId"> & {
  employeeId: EmployeeId
}

/** 従業員の異動・在籍イベントという履歴事実。 */
export class EmployeeEventEntity {
  private static parse(props: unknown): EmployeeEventProps {
    const parsed = employeeEventPropsSchema.parse(props)
    return { ...parsed, employeeId: restoreWorkforceId("employee", parsed.employeeId) }
  }

  private constructor(private readonly props: EmployeeEventProps) {
    Object.freeze(this)
  }

  static create(props: Omit<EmployeeEventProps, "id">): EmployeeEventEntity {
    return new EmployeeEventEntity(EmployeeEventEntity.parse({ ...props, id: null }))
  }

  static restore(props: unknown): EmployeeEventEntity {
    return new EmployeeEventEntity(EmployeeEventEntity.parse(props))
  }

  toProps(): EmployeeEventProps {
    return this.props
  }
}
