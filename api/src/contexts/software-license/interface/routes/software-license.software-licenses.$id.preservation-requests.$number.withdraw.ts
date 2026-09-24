import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseInputError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseConflictError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: licenseIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "json",
    z.strictObject({
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(1).max(1000),
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SoftwareLicenseForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "software-license",
          recordKind: "license-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
      },
      {
        authentication,
        number: c.req.valid("param").number,
        proposalDigest: c.req.valid("json").proposal_digest,
        reason: c.req.valid("json").reason,
      },
    )
    if (result instanceof RecordPreservationWithdrawalError) {
      switch (result.code) {
        case "invalid":
          throw new SoftwareLicenseInputError({ message: result.message })
        case "forbidden":
          throw new SoftwareLicenseForbiddenError()
        case "not_found":
          throw new SoftwareLicenseNotFoundError()
        case "conflict":
          throw new SoftwareLicenseConflictError()
        case "unavailable":
          throw new SoftwareLicenseUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
