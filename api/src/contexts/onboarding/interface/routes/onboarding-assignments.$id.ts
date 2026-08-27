import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import { CancelOnboardingAssignment } from "@/contexts/onboarding/application/cancel-onboarding-assignment"
import { UpdateOnboardingAssignment } from "@/contexts/onboarding/application/update-onboarding-assignment"
import type { EmployeeDirectoryEntryValue } from "@/contexts/company/domain/values/employee-directory-entry.value"
import type { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppOnboardingAssignment } from "@/lib/app-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 割り当てをレスポンス用の snake_case に整形する。 */
function toResponseBody(assignment: OnboardingAssignment, employee: EmployeeDirectoryEntryValue) {
  return zAppOnboardingAssignment.parse({
    id: assignment.id,
    employee_code: employee.code,
    employee_name: employee.name,
    template_code: assignment.templateCode,
    kind: assignment.kind,
    status: assignment.status,
    assigned_at: assignment.assignedAt,
    tasks: assignment.tasks.map((task) => ({
      id: task.id,
      template_task_code: task.templateTaskCode,
      title: task.title,
      order: task.order,
      status: task.status,
      completed_at: task.completedAt,
    })),
  })
}

// @authorization service - session を application service に渡して判定する
/** GET /onboarding-assignments/:id — 割り当ての詳細（本人か特権ロール） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignmentId = validateIntParam(c.req.param("id"), "assignment")

  const result = await (async () => {
    const command = {
      assignmentId,
      viewerEmployeeId: session.employeeId,
      session: session,
    }

    const assignmentRepository = new OnboardingAssignmentRepository(c)

    const assignment = await assignmentRepository.findById(command.assignmentId)

    if (assignment instanceof Error) {
      return new UnexpectedError("failed to find assignment", { cause: assignment })
    }

    if (assignment === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    const isOwner = assignment.employeeId === command.viewerEmployeeId

    if (isOwner === false && command.session.hasPermission("onboarding:view:all") === false) {
      return new ForbiddenError("cannot view assignment", "forbidden")
    }

    const employeeRepository = new EmployeeRepository(c)

    const employee = await employeeRepository.findById(assignment.employeeId)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("assignment not found", "assignment_not_found")
    }

    return { assignment, employee }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.json(toResponseBody(result.assignment, result.employee), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /onboarding-assignments/:id — 割当日を変更（特権ロールのみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ assigned_at: z.string().datetime() })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const assignmentId = validateIntParam(c.req.param("id"), "assignment")

    const json = c.req.valid("json")

    const result = await new UpdateOnboardingAssignment(c).run({
      assignmentId,
      session: session,
      assignedAt: json.assigned_at,
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.json(toResponseBody(result.assignment, result.employee), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /onboarding-assignments/:id — 割り当てを取り消し（特権ロールのみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignmentId = validateIntParam(c.req.param("id"), "assignment")

  const result = await new CancelOnboardingAssignment(c).run({
    assignmentId,
    session: session,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
