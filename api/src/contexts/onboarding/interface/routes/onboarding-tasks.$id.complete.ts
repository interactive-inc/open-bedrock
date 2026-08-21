import { CompleteOnboardingTask } from "@/contexts/onboarding/application/complete-onboarding-task"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppOnboardingTask } from "@/lib/app-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const taskId = validateIntParam(c.req.param("id"), "task")

  const task = await new CompleteOnboardingTask(c).run({
    taskId,
    session: session,
    completedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (task instanceof ApplicationError) {
    throw toHttpException(task)
  }

  const responseBody = zAppOnboardingTask.parse({
    id: task.id,
    template_task_code: task.templateTaskCode,
    title: task.title,
    order: task.order,
    status: task.status,
    completed_at: task.completedAt,
  })

  return c.json(responseBody, 200)
})
