import { factory } from "@/lib/factory"
import { applications, applicationTemplates, employees } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /applications/inbox — 承認待ちの申請一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
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
