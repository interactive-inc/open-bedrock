import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { zAppAttendanceSourceFreeze } from "@/contexts/attendance/interface/http/response-schemas"
import { PrepareRecordSourceFreezeAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-record-source-freeze-authorization.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"

/** 現在の人の管理権限で停止世代を確認する。読み取りは再認証を消費しない。 */
export function createAttendanceSourceFreezeReadHandlers() {
  return attendanceFactory.createHandlers(
    zValidator("param", z.strictObject({ freezeId: z.uuid() })),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SystemForbiddenError()
      const authorization = await new PrepareRecordSourceFreezeAuthorizationAdapter(c).prepare({
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
      const freeze = await new RecordSourceFreezeRepository({
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
        freeze.snapshot.ownerContext !== "attendance" ||
        freeze.snapshot.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
      )
        throw new SystemHTTPException({
          status: 404,
          code: "record_source_freeze_not_found",
          detail: "Source freeze not found",
        })
      return c.json(zAppAttendanceSourceFreeze.parse({ freeze: freeze.snapshot }))
    },
  )
}
