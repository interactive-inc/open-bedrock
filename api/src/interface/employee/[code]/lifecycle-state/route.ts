import { GetLifecycleState } from "@/application/employee-lifecycle/get-lifecycle-state"
import { GetEmployee } from "@/application/employee/get-employee"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import {
  appendLifecycleDeniedAudit,
  appendLifecycleReadAudit,
  lifecycleNoStore,
  resolveLifecycleReadAuthorization,
} from "@/interface/employee/lifecycle-route-contract"
import { fingerprintLifecycleFilter } from "@/lib/pagination/lifecycle-cursor"
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

export const GET = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator("query", z.object({ as_of: isoDate.optional() }).strict()),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const employee = await new GetEmployee(c).run({
      code: validateCodeParam(c.req.param("code"), "employee"),
    })
    if (employee instanceof ApplicationError) throw new NotFoundError("employee not found")
    const authorization = await resolveLifecycleReadAuthorization(c, session, employee.id)
    if (authorization instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (authorization === null) {
      await appendLifecycleDeniedAudit({
        c,
        session,
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
    if (state instanceof ApplicationError) throw toHttpException(state)
    const filterFingerprint = await fingerprintLifecycleFilter([employee.id, state.asOf, "state"])
    await appendLifecycleReadAudit({
      c,
      session,
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
