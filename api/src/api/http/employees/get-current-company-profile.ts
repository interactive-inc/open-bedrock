import type { Context } from "@/env"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zAppAuthMe } from "@/api/http/company/response-schemas"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"

/** System SessionとCompany従業員を現在利用者の表示profileへ合成する。 */
export class GetCurrentCompanyProfile {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute() {
    const session = this.c.var.session
    if (session === null) throw new UnauthorizedError()
    if (session.employeeId === null) throw new NotFoundError("employee not found")
    const employee = await new CompanyEmployeeDirectoryReadAdapter(this.c).findById(
      restoreWorkforceId("employee", String(session.employeeId)),
    )
    if (employee instanceof Error) throw new InternalError("failed to load employee profile")
    if (employee === null) throw new NotFoundError("employee not found")

    return zAppAuthMe.parse({
      id: employee.id,
      code: employee.employeeCode,
      name: employee.officialName,
      email: employee.email ?? "",
      role: session.roleKeys[0] ?? "authenticated",
      dept_name: employee.primaryAssignment?.organizationUnitName ?? null,
      position: employee.primaryAssignment?.positionTitle ?? null,
      permissions: [...session.permissions],
      role_keys: [...session.roleKeys],
      phone: employee.phone,
    })
  }
}
