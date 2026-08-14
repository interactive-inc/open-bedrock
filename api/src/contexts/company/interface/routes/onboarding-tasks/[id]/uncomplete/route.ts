import { UncompleteOnboardingTask } from "@/contexts/company/application/onboarding/uncomplete-onboarding-task"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppOnboardingTask } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

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
