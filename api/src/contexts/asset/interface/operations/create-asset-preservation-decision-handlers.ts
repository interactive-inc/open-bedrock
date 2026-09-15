import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { assetRecordRouteSchema } from "@/contexts/asset/interface/http/asset-input-schemas"
import { PrepareCompanyRecordProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-decision.adapter"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  AssetForbiddenError,
  AssetInputError,
  AssetNotFoundError,
  AssetConflictError,
  AssetUnavailableError,
} from "@/contexts/asset/interface/errors"
/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createAssetPreservationDecisionHandlers(action: "approve" | "reject") {
  return assetFactory.createHandlers(
    zValidator("param", assetRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
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
      if (authentication === undefined) throw new AssetForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "asset",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
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
            throw new AssetInputError({ message: result.message })
          case "forbidden":
            throw new AssetForbiddenError()
          case "not_found":
            throw new AssetNotFoundError()
          case "conflict":
            throw new AssetConflictError()
          case "unavailable":
            throw new AssetUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
