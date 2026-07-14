import { canDeleteEmployee } from "@/lib/employee/can-delete-employee"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  session: SessionPayload
  viewerEmployeeId: number
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * Public APIs never physically delete an employee. Historical business records,
 * approvals, evaluations, attendance, and audit actor references must remain intact.
 */
export class DeleteEmployee {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    if (canDeleteEmployee(command.session) === false) {
      return new ForbiddenError("cannot delete employees", "forbidden")
    }
    const employee = await new EmployeeRepository(this.c).findByCode(command.code)
    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }
    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }
    return new ConflictError(
      "employee history must be preserved; use the archive operation",
      "employee_archive_required",
    )
  }
}
