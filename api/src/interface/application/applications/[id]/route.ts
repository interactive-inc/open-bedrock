import { toApplicationId } from "@/domain/application/to-application-id"
import { factory } from "@/lib/factory"
import { applications, applicationTemplates, employees } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { eq } from "drizzle-orm"
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applicationId = toApplicationId(c.req.param("id") ?? "")

  if (applicationId === null) {
    throw new BadRequestError("invalid application id")
  }

  const rows = await c.var.database
    .select({
      application: applications,
      templateCode: applicationTemplates.code,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(eq(applications.id, applicationId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("application not found")
  }

  const responseBody = {
    id: row.application.id,
    template_code: row.templateCode ?? "",
    template_name: row.templateName ?? "",
    applicant_name: row.applicantName ?? "",
    status: row.application.status,
    current_step: row.application.currentStep,
    payload: JSON.parse(row.application.payload),
    created_at: row.application.createdAt,
  }

  return c.json(responseBody, 200)
})
