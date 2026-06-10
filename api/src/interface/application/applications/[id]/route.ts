import { UpdateApplication } from "@/application/application/update-application"
import { WithdrawApplication } from "@/application/application/withdraw-application"
import { canDecideApplication } from "@/domain/application/can-decide-application"
import { factory } from "@/lib/factory"
import { applications, applicationTemplates, employees } from "@/schema"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applicationId = validateIntParam(c.req.param("id"), "application")

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

  // 申請者本人か承認権限を持つロールのみ閲覧できる。ID 走査による他者申請の漏えいを防ぐ。
  const isOwner = row.application.applicantId === session.employeeId

  if (isOwner === false && canDecideApplication(session.role) === false) {
    throw new ForbiddenError()
  }

  let payload: unknown
  try {
    payload = JSON.parse(row.application.payload)
  } catch {
    throw new InternalError("invalid payload data")
  }

  const responseBody = {
    id: row.application.id,
    template_code: row.templateCode ?? "",
    template_name: row.templateName ?? "",
    applicant_name: row.applicantName ?? "",
    status: row.application.status,
    current_step: row.application.currentStep,
    payload,
    created_at: row.application.createdAt,
  }

  return c.json(responseBody, 200)
})

// PUT /applications/:id — 本人が申請内容（payload）を更新（pending のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ payload: jsonPayloadSchema(10_000) })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const applicationId = validateIntParam(c.req.param("id"), "application")

    const body = c.req.valid("json")

    const updated = await new UpdateApplication(c).run({
      applicationId,
      applicantId: session.employeeId,
      payload: body.payload,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update application")
    }

    if ("reason" in updated) {
      if (updated.reason === "application_not_found") {
        throw new NotFoundError("application not found")
      }

      if (updated.reason === "not_applicant") {
        throw new ForbiddenError("not the applicant")
      }

      throw new ConflictError("application is already decided")
    }

    return c.json({ id: updated.id, status: updated.status, payload: updated.payload }, 200)
  },
)

// DELETE /applications/:id — 本人が申請を取り下げ（pending のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const applicationId = validateIntParam(c.req.param("id"), "application")

  const result = await new WithdrawApplication(c).run({
    applicationId,
    applicantId: session.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to withdraw application")
  }

  if (result.reason === "application_not_found") {
    throw new NotFoundError("application not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  if (result.reason === "not_pending") {
    throw new ConflictError("application is already decided")
  }

  return c.body(null, 204)
})
