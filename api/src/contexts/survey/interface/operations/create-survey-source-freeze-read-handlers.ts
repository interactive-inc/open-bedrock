import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { surveySourceFreezeResponseSchema } from "@/contexts/survey/interface/http/response-schemas"
import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"

/** 現在の管理権限でsurvey記録の停止世代を読む。 */
export function createSurveySourceFreezeReadHandlers() {
  return surveyFactory.createHandlers(
    zValidator("param", z.strictObject({ freezeId: z.uuid() })),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SystemForbiddenError()
      const authorization = await prepareSystemRecordSourceFreezeAuthorization(c, {
        authentication,
        now: c.var.now(),
        stepUpToken: null,
      })
      if (authorization === "forbidden") throw new SystemForbiddenError()
      if (authorization instanceof Error)
        throw new SystemHTTPException({
          status: 503,
          code: "record_source_freeze_unavailable",
          detail: "Source freeze authorization unavailable",
        })
      const freeze = await openSystemRecordSourceFreezes({
        env: c.env,
        assertions: authorization.assertions,
      }).find(c.req.valid("param").freezeId)
      if (freeze instanceof Error)
        throw new SystemHTTPException({
          status: 503,
          code: "record_source_freeze_unavailable",
          detail: "Source freeze lookup unavailable",
        })
      if (
        freeze === null ||
        freeze.snapshot.ownerContext !== "survey" ||
        freeze.snapshot.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
      )
        throw new SystemHTTPException({
          status: 404,
          code: "record_source_freeze_not_found",
          detail: "Source freeze not found",
        })
      return c.json(surveySourceFreezeResponseSchema.parse({ freeze: freeze.snapshot }))
    },
  )
}
