import { ListMyCareerApplications } from "@/contexts/career/application/list-my-career-applications"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppCareerApplicationList } from "@/lib/app-schemas"
import { careerApplications } from "@/contexts/career/infrastructure/schema/career"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /career-applications/me — 応募者本人の公募応募一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
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

  const applications = await new ListMyCareerApplications(c).run({
    applicantId: viewer.employeeId,
    limit,
    offset,
  })

  if (applications instanceof ApplicationError) {
    throw toHttpException(applications)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(careerApplications)
    .where(eq(careerApplications.applicantId, viewer.employeeId))

  const responseBody = zAppCareerApplicationList.parse({
    data: applications.map((application) => ({
      id: application.id,
      posting_id: application.postingId,
      applicant_id: application.applicantId,
      message: application.message,
      status: application.status,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
