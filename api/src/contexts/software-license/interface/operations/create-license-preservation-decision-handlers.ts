import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { PrepareCompanyRecordProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-decision.adapter"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseInputError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseConflictError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createLicensePreservationDecisionHandlers(action: "approve" | "reject") {
  return softwareLicenseFactory.createHandlers(
    ensureLicenseEnabled,
    zValidator("param", z.strictObject({ id: licenseIdSchema, number: licenseIdSchema })),
    zValidator(
      "json",
      z.strictObject({
        decision_target: z.strictObject({
          proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
          task_key: z.string().min(1).max(100),
          task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        }),
        comment: z.string().max(3000).nullable(),
      }),
    ),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SoftwareLicenseForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "software-license",
          recordKind: "license-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
        prepareDecision: async (input) => {
          const decision = await new PrepareCompanyRecordProcedureDecisionAdapter(c).prepare(input)
          if (decision instanceof CompanyConflictError)
            return new RecordPreservationDecisionError("conflict")
          if (decision instanceof CompanyUnexpectedError)
            return new RecordPreservationDecisionError("unavailable")
          return decision
        },
      }).execute({
        authentication,
        number: c.req.valid("param").number,
        action,
        body: c.req.valid("json"),
      })
      if (result instanceof RecordPreservationDecisionError) {
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
}
