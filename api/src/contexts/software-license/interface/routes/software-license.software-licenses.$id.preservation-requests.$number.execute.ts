import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseInputError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseConflictError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { RevalidateLicenseRecordSourceAdapter } from "@/contexts/software-license/infrastructure/adapters/revalidate-license-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原台帳、Company承認資格を再検査して一回だけ確定する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: licenseIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SoftwareLicenseForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "software-license",
        recordKind: "license-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateLicenseRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
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
