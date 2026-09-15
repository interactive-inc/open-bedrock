import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { certificationRecordRouteSchema } from "@/contexts/certification/interface/http/certification-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  CertificationForbiddenError,
  CertificationInputError,
  CertificationNotFoundError,
  CertificationConflictError,
  CertificationUnavailableError,
} from "@/contexts/certification/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", certificationRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
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
    if (authentication === undefined) throw new CertificationForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "certification",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
      },
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
      reason: c.req.valid("json").reason,
    })
    if (result instanceof RecordPreservationWithdrawalError) {
      switch (result.code) {
        case "invalid":
          throw new CertificationInputError({ message: result.message })
        case "forbidden":
          throw new CertificationForbiddenError()
        case "not_found":
          throw new CertificationNotFoundError()
        case "conflict":
          throw new CertificationConflictError()
        case "unavailable":
          throw new CertificationUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
