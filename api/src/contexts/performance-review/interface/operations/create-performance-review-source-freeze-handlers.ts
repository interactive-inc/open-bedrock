import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { recordSourceFreezeCommandSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"

/** performanceReview記録の停止と解除を、人の技術権限と再認証へ接続する。 */
export function createPerformanceReviewSourceFreezeHandlers(mode: "create" | "release") {
  return performanceReviewFactory.createHandlers(
    requireSystemStepUp,
    zValidator("param", z.object({ freezeId: z.uuid().optional() })),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", recordSourceFreezeCommandSchema.pick({ reason: true })),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SystemForbiddenError()
      const stepUpToken = c.req.header("x-system-step-up")
      if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
      const now = c.var.now()
      const authorization = await prepareSystemRecordSourceFreezeAuthorization(c, {
        authentication,
        now,
        stepUpToken,
      })
      if (authorization === "forbidden") throw new SystemForbiddenError()
      if (authorization instanceof Error)
        throw new SystemHTTPException({
          status: 503,
          code: "record_source_freeze_unavailable",
          detail: "Source freeze authorization unavailable",
        })
      const command = recordSourceFreezeCommandSchema.safeParse({
        id:
          mode === "create"
            ? c.req.valid("header")["idempotency-key"]
            : c.req.valid("param").freezeId,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
        ownerContext: "performance-review",
        actorAccountId: authorization.actorAccountId,
        reason: c.req.valid("json").reason,
      })
      if (!command.success)
        throw new SystemHTTPException({
          status: 400,
          code: "record_source_freeze_invalid",
          detail: "Source namespace and operation identifier are required",
        })
      const repository = openSystemRecordSourceFreezes({
        env: c.env,
        assertions: authorization.assertions,
      })
      const result =
        mode === "create"
          ? await new CreateRecordSourceFreeze({ repository }).execute(command.data, now)
          : await new ReleaseRecordSourceFreeze({ repository }).execute(command.data, now)
      if (result instanceof Error)
        throw new SystemHTTPException({
          status: 503,
          code: "record_source_freeze_unavailable",
          detail: "Source freeze operation unavailable",
        })
      if (result === "conflict")
        throw new SystemHTTPException({
          status: 409,
          code: "record_source_freeze_conflict",
          detail: "Source freeze generation conflicts with the request",
        })
      if (result === "not_found")
        throw new SystemHTTPException({
          status: 404,
          code: "record_source_freeze_not_found",
          detail: "Source freeze not found",
        })
      return c.json(
        { kind: result.kind, freeze: result.freeze.snapshot },
        result.kind === "created" ? 201 : 200,
      )
    },
  )
}
