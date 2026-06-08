import { canDecideApplication } from "@/domain/application/can-decide-application"
import { factory } from "@/lib/factory"
import { applications, applicationTemplates, employees } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { eq } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

// GET /applications/inbox — 承認待ちの申請一覧（承認権限を持つロールのみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideApplication(session.role) === false) {
    throw new ForbiddenError()
  }

  const rows = await c.var.database
    .select({
      application: applications,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(eq(applications.status, "pending"))

  const responseBody = rows.map((row) => ({
    id: row.application.id,
    template_name: row.templateName ?? "",
    applicant_name: row.applicantName ?? "",
    current_step: row.application.currentStep,
    status: row.application.status,
    created_at: row.application.createdAt,
  }))

  return c.json(responseBody, 200)
})
