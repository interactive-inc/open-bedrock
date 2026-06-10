import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { onboardingAssignments, onboardingTasks } from "@/schema"
import { eq } from "drizzle-orm"

// GET /onboarding/me — 本人に割り当てられたタスク一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const rows = await c.var.database
    .select({ task: onboardingTasks })
    .from(onboardingTasks)
    .innerJoin(onboardingAssignments, eq(onboardingAssignments.id, onboardingTasks.assignmentId))
    .where(eq(onboardingAssignments.employeeId, session.employeeId))
    .limit(limit)
    .offset(offset)

  const body = rows.map((row) => ({
    id: row.task.id,
    template_task_code: row.task.templateTaskCode,
    title: row.task.title,
    order: row.task.sortOrder,
    status: row.task.status,
    completed_at: row.task.completedAt,
  }))

  return c.json(body, 200)
})
