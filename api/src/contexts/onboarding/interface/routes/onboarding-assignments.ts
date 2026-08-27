import { AssignOnboarding } from "@/contexts/onboarding/application/assign-onboarding"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppOnboardingAssignment } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization service - session を application service に渡して判定する
/** POST /onboarding-assignments — テンプレートを社員へ割り当てる */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: codeSchema,
      template_code: codeSchema,
    }),
  ),
  async (c) => {
    const json = c.req.valid("json")
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const result = await new AssignOnboarding(c).run({
      session: viewer,
      employeeCode: json.employee_code,
      templateCode: json.template_code,
      assignedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppOnboardingAssignment.parse({
      id: result.assignment.id,
      employee_code: result.employee.employeeCode,
      employee_name: result.employee.officialName,
      template_code: result.assignment.templateCode,
      template_name: result.template.name,
      kind: result.assignment.kind,
      status: result.assignment.status,
      assigned_at: result.assignment.assignedAt,
      tasks: result.tasks.map((task) => ({
        id: task.id,
        template_task_code: task.templateTaskCode,
        title: task.title,
        order: task.order,
        status: task.status,
        completed_at: task.completedAt,
      })),
    })

    return c.json(responseBody, 201)
  },
)
