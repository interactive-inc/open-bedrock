import { ListMyCareerApplications } from "@/application/career/list-my-career-applications"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /career/applications/me — 応募者本人の公募応募一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const applications = await new ListMyCareerApplications(c).run({
    applicantId: viewer.employeeId,
  })

  if (applications instanceof Error) {
    throw new InternalError("failed to load applications")
  }

  const responseBody = applications.map((application) => ({
    id: application.id,
    posting_id: application.postingId,
    applicant_id: application.applicantId,
    message: application.message,
    status: application.status,
  }))

  return c.json(responseBody, 200)
})
