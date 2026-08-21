import { GoalRepository } from "@/contexts/performance-review/infrastructure/goal/goal.repository"
import { buildGoalTree } from "@/contexts/performance-review/domain/goal/build-goal-tree"
import { canReadGoalOf } from "@/contexts/performance-review/domain/goal/can-read-goal-of"
import { resolveEmployeeRelation } from "@/contexts/company/infrastructure/organization/resolve-employee-relation.repository"
import type { Goal } from "@/contexts/performance-review/domain/goal/goal.entity"
import { factory } from "@/contexts/company/interface/utils/factory"
import { UnexpectedError } from "@/lib/errors"
import { zAppGoalTree } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"

// @authorization service - session を application service に渡して判定する
/**
 * GET /performance-goals/tree?period= — 全社→部門→個人の目標ツリー。
 * 全社・部門目標は全認証者が閲覧でき、個人目標(葉)は閲覧スコープでフィルタする。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null

  const goals = await new GoalRepository(c).findAllByPeriod(period)

  if (goals instanceof Error) {
    throw toHttpException(new UnexpectedError("failed to load goals", { cause: goals }))
  }

  const visible: Array<Goal> = []

  for (const goal of goals) {
    if (goal.ownerType !== "individual") {
      visible.push(goal)
      continue
    }

    const relation = await resolveEmployeeRelation({
      c,
      viewerEmployeeId: session.employeeId,
      targetEmployeeId: goal.employeeId,
    })

    if (relation instanceof Error) {
      throw toHttpException(
        new UnexpectedError("failed to resolve goal visibility", { cause: relation }),
      )
    }

    if (canReadGoalOf(session, relation)) visible.push(goal)
  }

  const roots = buildGoalTree({ goals: visible })

  const body = zAppGoalTree.parse({ period, roots })

  return c.json(body, 200)
})
