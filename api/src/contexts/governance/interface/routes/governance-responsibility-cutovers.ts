import { prepareGovernanceAuditRecord } from "@/api/http/audit/prepare-governance-audit-record"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { FinalizeGovernanceResponsibilityCutover } from "@/contexts/governance/application/finalize-governance-responsibility-cutover"
import { GovernanceResponsibilityCutoverAdapter } from "@/contexts/governance/infrastructure/adapters/governance-responsibility-cutover.adapter"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const request = z.strictObject({ freeze_id: z.string().uuid() })

// @authorization service - application serviceが人の組織責任管理権限と停止世代を再確認する
export const POST = factory.createHandlers(verifyBearer, zValidator("json", request), async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const adapter = new GovernanceResponsibilityCutoverAdapter({
    database: c.env.DB,
    now: c.env.NOW,
    sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
    prepareAudit: (audit) => prepareGovernanceAuditRecord({ c, ...audit }),
  })
  const result = await new FinalizeGovernanceResponsibilityCutover({
    finalize: (props) => adapter.execute(props),
  }).execute({ session, freezeId: c.req.valid("json").freeze_id })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, result.replayed ? 200 : 201)
})
