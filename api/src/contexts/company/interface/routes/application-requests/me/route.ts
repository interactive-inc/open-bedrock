import { ListMyApplications } from "@/contexts/company/application/application/list-my-applications"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppApplicationMineList } from "@/lib/app-schemas"
import { applications } from "@/schema"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /application-requests/me — 申請者本人の申請一覧（ユースケース経由） */
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

  const applicationRows = await new ListMyApplications(c).run({
    applicantId: session.employeeId,
    limit,
    offset,
  })

  if (applicationRows instanceof ApplicationError) {
    throw toHttpException(applicationRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(applications)
    .where(eq(applications.applicantId, session.employeeId))

  const responseBody = zAppApplicationMineList.parse({
    data: applicationRows.map((application) => ({
      id: application.id,
      template_id: application.templateId,
      status: application.status,
      current_step: application.currentStep,
      payload: application.payload,
      created_at: application.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
