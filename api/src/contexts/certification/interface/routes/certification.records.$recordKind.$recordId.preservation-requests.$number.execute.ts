import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  CertificationForbiddenError,
  CertificationInputError,
  CertificationNotFoundError,
  CertificationConflictError,
  CertificationUnavailableError,
} from "@/contexts/certification/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { certificationFactory } from "@/contexts/certification/interface/request-environment/certification-factory"
import { certificationRecordRouteSchema } from "@/contexts/certification/interface/http/certification-input-schemas"
import { RevalidateCertificationRecordSourceAdapter } from "@/contexts/certification/infrastructure/adapters/revalidate-certification-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = certificationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", certificationRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new CertificationForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "certification",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateCertificationRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) =>
        revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
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
