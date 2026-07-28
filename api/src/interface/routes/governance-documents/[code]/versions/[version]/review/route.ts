import { GovernancePublication } from "@/application/governance/governance-publication"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { parseGovernanceCode } from "@/interface/utils/parse-governance-code"
import { parseGovernanceVersion } from "@/interface/utils/parse-governance-version"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

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
  const result = await new GovernancePublication(c).decideReview({
    session,
    code,
    version,
    orgRoleCode: body.org_role_code,
    decision: body.decision,
    comment: body.comment ?? null,
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
