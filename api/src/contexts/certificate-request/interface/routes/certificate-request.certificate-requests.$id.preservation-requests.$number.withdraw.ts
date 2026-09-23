import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { certificateRequestIdSchema } from "@/contexts/certificate-request/interface/http/certificate-request-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  CertificateRequestForbiddenError,
  CertificateRequestInputError,
  CertificateRequestNotFoundError,
  CertificateRequestConflictError,
  CertificateRequestUnavailableError,
} from "@/contexts/certificate-request/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = certificateRequestFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: certificateRequestIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
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
    if (authentication === undefined) throw new CertificateRequestForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "certificate-request",
        recordKind: "certificate-request-record",
        recordId: String(c.req.valid("param").id),
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
          throw new CertificateRequestInputError({ message: result.message })
        case "forbidden":
          throw new CertificateRequestForbiddenError()
        case "not_found":
          throw new CertificateRequestNotFoundError()
        case "conflict":
          throw new CertificateRequestConflictError()
        case "unavailable":
          throw new CertificateRequestUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
