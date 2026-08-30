import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/repositories/career-application.repository"

import { UpdateMyCareerApplication } from "@/contexts/career/application/update-my-career-application"
import type { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppCareerApplication } from "@/contexts/career/interface/http/response-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const applicationIdSchema = z.coerce.number().int().positive()

/** 応募をレスポンス用の snake_case に整形する。 */
function toResponseBody(application: CareerApplication) {
  return zAppCareerApplication.parse({
    id: application.id,
    posting_id: application.postingId,
    applicant_id: application.applicantId,
    message: application.message,
    status: application.status,
  })
}

// @authorization owner - 本人のリソースに限定する
/** GET /career-applications/:id — 応募の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const applicationId = applicationIdSchema.safeParse(c.req.param("id") ?? "")

  if (applicationId.success === false) {
    throw new BadRequestError("invalid application id")
  }

  const application = await (async () => {
    const command = {
      applicationId: applicationId.data,
      applicantId: viewer.employeeId,
    }

    const applicationRepository = new CareerApplicationRepository(c)

    const application = await applicationRepository.findById(command.applicationId)

    if (application instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: application })
    }

    if (application === null) {
      return new NotFoundError("career application not found", "application_not_found")
    }

    if (application.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    return application
  })()

  if (application instanceof ApplicationError) {
    throw toHttpException(application)
  }

  return c.json(toResponseBody(application), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /career-applications/:id — 応募メッセージを変更（本人のみ・選考前のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      message: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const applicationId = applicationIdSchema.safeParse(c.req.param("id") ?? "")

    if (applicationId.success === false) {
      throw new BadRequestError("invalid application id")
    }

    const json = c.req.valid("json")

    const application = await new UpdateMyCareerApplication(c).run({
      applicationId: applicationId.data,
      applicantId: viewer.employeeId,
      message: json.message ?? null,
    })

    if (application instanceof ApplicationError) {
      throw toHttpException(application)
    }

    return c.json(toResponseBody(application), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /career-applications/:id — 応募を取り下げ（本人のみ・選考前のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const applicationId = applicationIdSchema.safeParse(c.req.param("id") ?? "")

  if (applicationId.success === false) {
    throw new BadRequestError("invalid application id")
  }

  const result = await (async () => {
    const command = {
      applicationId: applicationId.data,
      applicantId: viewer.employeeId,
    }

    const applicationRepository = new CareerApplicationRepository(c)

    const current = await applicationRepository.findById(command.applicationId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find career application", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("career application not found", "application_not_found")
    }

    if (current.applicantId !== command.applicantId) {
      return new ForbiddenError("not the applicant", "not_applicant")
    }

    if (current.status !== "applied") {
      return new ConflictError("career application is already decided", "application_decided")
    }

    const deleted = await applicationRepository.delete(command.applicationId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete career application", { cause: deleted })
    }

    // リポジトリ層の status guard で並行変更を検出した場合
    if (deleted !== null && "reason" in deleted) {
      return new ConflictError("career application is already decided", "application_decided")
    }

    return { reason: "withdrawn" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
