import { AssignOnboarding } from "@/application/onboarding/assign-onboarding"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /onboarding/assign — テンプレートを社員へ割り当てる
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: z.string().min(1),
      template_code: z.string().min(1),
    }),
  ),
  async (c) => {
    const json = c.req.valid("json")
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const result = await new AssignOnboarding(c).run({
      viewerRole: viewer.role,
      employeeCode: json.employee_code,
      templateCode: json.template_code,
      assignedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof Error) {
      throw new InternalError("failed to assign onboarding")
    }

    if ("reason" in result) {
      if (result.reason === "forbidden") {
        throw new ForbiddenError("not authorized")
      }
      throw new NotFoundError(result.reason)
    }

    const responseBody = {
      id: result.assignment.id,
      employee_code: result.employee.code,
      employee_name: result.employee.name,
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
    }

    return c.json(responseBody, 201)
  },
)
