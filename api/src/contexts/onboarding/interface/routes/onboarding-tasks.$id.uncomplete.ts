import { UncompleteOnboardingTask } from "@/contexts/onboarding/application/uncomplete-onboarding-task"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppOnboardingTask } from "@/contexts/onboarding/interface/http/response-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /onboarding-tasks/:id/uncomplete — タスクの完了を取り消す（本人か特権ロール） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const taskId = validateIntParam(c.req.param("id"), "task")

  const task = await new UncompleteOnboardingTask(c).run({
    taskId,
    session: session,
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
