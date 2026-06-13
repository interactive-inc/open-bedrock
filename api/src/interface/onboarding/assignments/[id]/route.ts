import { CancelOnboardingAssignment } from "@/application/onboarding/cancel-onboarding-assignment"
import { GetOnboardingAssignment } from "@/application/onboarding/get-onboarding-assignment"
import { UpdateOnboardingAssignment } from "@/application/onboarding/update-onboarding-assignment"
import type { Employee } from "@/domain/employee/employee"
import type { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 割り当てをレスポンス用の snake_case に整形する。
function toResponseBody(assignment: OnboardingAssignment, employee: Employee) {
  return {
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
  }
}

// GET /onboarding/assignments/:id — 割り当ての詳細（本人か特権ロール）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignmentId = validateIntParam(c.req.param("id"), "assignment")

  const result = await new GetOnboardingAssignment(c).run({
    assignmentId,
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to load assignment")
  }

  if ("reason" in result) {
    if (result.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("assignment not found")
  }

  return c.json(toResponseBody(result.assignment, result.employee), 200)
})

// PUT /onboarding/assignments/:id — 割当日を変更（特権ロールのみ）
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
      viewerRole: session.role,
      assignedAt: json.assigned_at,
    })

    if (result instanceof Error) {
      throw new InternalError("failed to update assignment")
    }

    if ("reason" in result) {
      if (result.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (result.reason === "not_modifiable") {
        throw new ConflictError("assignment is already completed")
      }

      throw new NotFoundError("assignment not found")
    }

    return c.json(toResponseBody(result.assignment, result.employee), 200)
  },
)

// DELETE /onboarding/assignments/:id — 割り当てを取り消し（特権ロールのみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignmentId = validateIntParam(c.req.param("id"), "assignment")

  const result = await new CancelOnboardingAssignment(c).run({
    assignmentId,
    viewerRole: session.role,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel assignment")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "not_modifiable") {
    throw new ConflictError("assignment is already completed")
  }

  if (result.reason === "assignment_not_found") {
    throw new NotFoundError("assignment not found")
  }

  return c.body(null, 204)
})
