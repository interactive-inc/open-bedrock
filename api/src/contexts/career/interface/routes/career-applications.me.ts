import { UnexpectedError } from "@/lib/errors"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/repositories/career-application.repository"

import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppCareerApplicationList } from "@/contexts/career/interface/http/response-schemas"
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

  const applications = await (async () => {
    const command = {
      applicantId: viewer.employeeId,
      limit,
      offset,
    }

    const applicationRepository = new CareerApplicationRepository(c)

    const applications = await applicationRepository.findByApplicantId({
      applicantId: command.applicantId,
      limit: command.limit,
      offset: command.offset,
    })

    if (applications instanceof Error) {
      return new UnexpectedError("failed to find career applications", { cause: applications })
    }

    return applications
  })()

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
