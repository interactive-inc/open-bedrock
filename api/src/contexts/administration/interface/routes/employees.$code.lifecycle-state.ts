import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { NotFoundError as ApplicationNotFoundError, UnexpectedError } from "@/lib/errors"
import { GetLifecycleState } from "@/contexts/company/infrastructure/employee-lifecycle/get-lifecycle-state.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { LifecycleAccess } from "@/contexts/administration/interface/utils/lifecycle-access"
import { lifecycleNoStore } from "@/contexts/administration/interface/middlewares/lifecycle-no-store"
import { fingerprintLifecycleFilter } from "@/lib/pagination/fingerprint-lifecycle-filter"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

function assignmentResponse(assignment: {
  periodId: string
  employmentPeriodId: string
  departmentCode: string
  departmentName: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeCode: string | null
  startsOn: string
  endsOn: string | null
}) {
  return {
    period_id: assignment.periodId,
    employment_period_id: assignment.employmentPeriodId,
    department_code: assignment.departmentCode,
    department_name: assignment.departmentName,
    assignment_type: assignment.assignmentType,
    position_title: assignment.positionTitle,
    manager_employee_code: assignment.managerEmployeeCode,
    starts_on: assignment.startsOn,
    ends_on: assignment.endsOn,
  }
}

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator("query", z.object({ as_of: isoDate.optional() }).strict()),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const employee = await (async () => {
      const command = {
        code: validateCodeParam(c.req.param("code"), "employee"),
      }

      const employeeRepository = new EmployeeRepository(c)

      const employee = await employeeRepository.findByCode(command.code)

      if (employee instanceof Error) {
        return new UnexpectedError("failed to find employee", {
          cause: employee,
        })
      }

      if (employee === null) {
        return new ApplicationNotFoundError("employee not found", "employee_not_found")
      }

      return employee
    })()
    if (employee instanceof ApplicationError) throw new NotFoundError("employee not found")
    const authorization = await new LifecycleAccess({
      c,
      session,
    }).resolveReadAuthorization(employee.id)
    if (authorization instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (authorization === null) {
      await new LifecycleAccess({ c, session }).appendDeniedAudit({
        targetEmployeeId: employee.id,
        permission: "employee:read",
        reasonCode: "lifecycle_scope_denied",
      })
      throw new NotFoundError("employee not found")
    }
    const state = await new GetLifecycleState(c).run({
      employeeId: employee.id,
      asOf: c.req.valid("query").as_of,
    })
    if (state instanceof CompanyOperationError) {
      throw new InternalError("failed to load employee lifecycle state")
    }
    const filterFingerprint = await fingerprintLifecycleFilter([employee.id, state.asOf, "state"])
    await new LifecycleAccess({ c, session }).appendReadAudit({
      action: authorization.auditAction,
      targetEmployeeId: employee.id,
      scope: authorization.scope,
      resultCount: 1,
      filterFingerprint,
    })
    return c.json(
      {
        employee_code: state.employeeCode,
        as_of: state.asOf,
        status: state.status,
        archived: state.archived,
        employment_period_id: state.employmentPeriodId,
        primary_assignment:
          state.primaryAssignment === null ? null : assignmentResponse(state.primaryAssignment),
        concurrent_assignments: state.concurrentAssignments.map(assignmentResponse),
        responsibility_department_codes: state.responsibilityDepartmentCodes,
        employee_revision: state.employeeRevision,
        organization_revision: state.organizationRevision,
      },
      200,
    )
  },
)
