import { GetManagementDashboard } from "@/api/http/dashboard/management/get-management-dashboard"
import { ApplicationError } from "@/lib/errors"
import { zAppManagementDashboard } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"

// @authorization permission - 権限キーで判定する
/** GET /dashboard/management — 経営ダッシュボードの横断集計。management_dashboard:view のみ。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("management_dashboard:view") === false) {
    throw new ForbiddenError()
  }

  const summary = await new GetManagementDashboard(c).run()

  if (summary instanceof ApplicationError) {
    throw toHttpException(summary)
  }

  const body = zAppManagementDashboard.parse(summary)

  return c.json(body, 200)
})
