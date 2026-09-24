import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  DocumentForbiddenError,
  DocumentInputError,
  DocumentNotFoundError,
  DocumentConflictError,
  DocumentUnavailableError,
} from "@/contexts/document/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { documentIdSchema } from "@/contexts/document/interface/http/document-input-schemas"
import { RevalidateDocumentRecordSourceAdapter } from "@/contexts/document/infrastructure/adapters/revalidate-document-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: documentIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new DocumentForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "document",
          recordKind: "document-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateDocumentRecordSourceAdapter({
              env: c.env,
              var: c.var,
              sourceNamespace,
            }).prepare(source),
        },
        prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
      },
      {
        authentication,
        number: c.req.valid("param").number,
        proposalDigest: c.req.valid("json").proposal_digest,
      },
    )
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new DocumentInputError({ message: result.message })
        case "forbidden":
          throw new DocumentForbiddenError()
        case "not_found":
          throw new DocumentNotFoundError()
        case "conflict":
          throw new DocumentConflictError()
        case "unavailable":
          throw new DocumentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
