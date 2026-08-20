import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { readDashboard } from "@/api/http/dashboard/read-dashboard"

// @authorization permission - 権限キーで判定する
/** GET /dashboard — 従業員・目標・申請・調査の横断的な集計 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("dashboard:view") === false) {
    throw new ForbiddenError()
  }

  const body = await readDashboard(c, c.env.NOW ?? new Date().toISOString())
  if (body instanceof Error) throw body

  return c.json(body, 200)
})
