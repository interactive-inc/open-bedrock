import { UncompleteOnboardingTask } from "@/application/onboarding/uncomplete-onboarding-task"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"

// POST /onboarding/tasks/:id/uncomplete — タスクの完了を取り消す（本人か特権ロール）
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const taskId = validateIntParam(c.req.param("id"), "task")

  const task = await new UncompleteOnboardingTask(c).run({
    taskId,
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
  })

  if (task instanceof Error) {
    throw new InternalError("failed to uncomplete task")
  }

  if ("reason" in task) {
    if (task.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("task not found")
  }

  const responseBody = {
    id: task.id,
    template_task_code: task.templateTaskCode,
    title: task.title,
    order: task.order,
    status: task.status,
    completed_at: task.completedAt,
  }

  return c.json(responseBody, 200)
})
