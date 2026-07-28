import { GetGoalTree } from "@/application/goal/get-goal-tree"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoalTree } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"

/**
 * GET /goals/tree?period= — 全社→部門→個人の目標ツリー。
 * 全社・部門目標は全認証者が閲覧でき、個人目標(葉)は閲覧スコープでフィルタする。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null

  const roots = await new GetGoalTree(c).run({ period, session })

  if (roots instanceof ApplicationError) {
    throw toHttpException(roots)
  }

  const body = zAppGoalTree.parse({ period, roots })

  return c.json(body, 200)
})
