import { ListMyApplications } from "@/application/application/list-my-applications"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /applications/me — 申請者本人の申請一覧（ユースケース経由）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applications = await new ListMyApplications(c).run({
    applicantId: session.employeeId,
  })

  if (applications instanceof Error) {
    throw new InternalError("failed to load applications")
  }

  const responseBody = applications.map((application) => ({
    id: application.id,
    template_id: application.templateId,
    status: application.status,
    current_step: application.currentStep,
    payload: application.payload,
    created_at: application.createdAt,
  }))

  return c.json(responseBody, 200)
})
