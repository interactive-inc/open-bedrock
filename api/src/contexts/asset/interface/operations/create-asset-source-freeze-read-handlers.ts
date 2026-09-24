import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { assetSourceFreezeResponseSchema } from "@/contexts/asset/interface/http/response-schemas"
import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"

/** 現在の管理権限でasset記録の停止世代を読む。 */
export function createAssetSourceFreezeReadHandlers() {
  return assetFactory.createHandlers(
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
        freeze.snapshot.ownerContext !== "asset" ||
        freeze.snapshot.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
      )
        throw new SystemHTTPException({
          status: 404,
          code: "record_source_freeze_not_found",
          detail: "Source freeze not found",
        })
      return c.json(assetSourceFreezeResponseSchema.parse({ freeze: freeze.snapshot }))
    },
  )
}
