import { ApproveGovernanceReview } from "@/contexts/governance/application/approve-governance-review"
import { RejectGovernanceReview } from "@/contexts/governance/application/reject-governance-review"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { parseGovernanceCode } from "@/contexts/governance/interface/http/parse-governance-code"
import { parseGovernanceVersion } from "@/contexts/governance/interface/http/parse-governance-version"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

type GovernanceAuditProps = Omit<Parameters<typeof prepareGovernanceAudit>[0], "c">

const request = z.strictObject({
  org_role_code: z.string().min(2).max(120),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().max(2_000).nullable().optional(),
})

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(verifyBearer, zValidator("json", request), async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  const version = parseGovernanceVersion(c.req.param("version"))
  if (code === null || version === null) throw new NotFoundError("governance version not found")
  const body = c.req.valid("json")
  const applicationContext = {
    context: c,
    prepareAudit: (audit: GovernanceAuditProps) => prepareGovernanceAudit({ c, ...audit }),
  }
  const input = {
    session,
    code,
    version,
    orgRoleCode: body.org_role_code,
    comment: body.comment ?? null,
  }

  if (body.decision === "approved") {
    const result = await new ApproveGovernanceReview(applicationContext).execute(input)
    if (result instanceof ApplicationError) throw toHttpException(result)
    if (result instanceof Error) throw result

    return c.json(result, 200)
  }

  const result = await new RejectGovernanceReview(applicationContext).execute(input)
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result

  return c.json(result, 200)
})
