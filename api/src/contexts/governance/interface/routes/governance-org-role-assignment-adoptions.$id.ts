import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { AdoptGovernanceOrgRoleAssignment } from "@/contexts/governance/application/adopt-governance-org-role-assignment"
import { GovernanceRoleAssignmentAdoptionSnapshotAdapter } from "@/contexts/governance/infrastructure/adapters/governance-role-assignment-adoption-snapshot.adapter"
import { ApplicationError, ForbiddenError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const request = z.strictObject({
  snapshot_digest: z.string().regex(/^[0-9a-f]{64}$/),
})

// @authorization service - 移行対象の全列と照合値は組織責任の管理者だけが取得する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (!session.permissions.has("governance:manage")) {
    throw toHttpException(
      new ForbiddenError("組織責任を移行する権限がありません", "governance_role_forbidden"),
    )
  }
  const assignmentId = validateIntParam(c.req.param("id"), "governance assignment adoption")
  const snapshot = await new GovernanceRoleAssignmentAdoptionSnapshotAdapter(c.env.DB).find(
    assignmentId,
  )
  if (snapshot instanceof Error) {
    throw toHttpException(
      new UnexpectedError("組織責任の元記録を確認できません", { cause: snapshot }),
    )
  }
  if (snapshot === null) {
    throw toHttpException(
      new NotFoundError("組織責任の元記録がありません", "governance_assignment_not_found"),
    )
  }
  const organizationRevision =
    (await c.env.DB.prepare(
      "SELECT revision FROM company_organizations WHERE id = 'organization:default'",
    ).first<number>("revision")) ?? 0

  return c.json({
    assignment_id: assignmentId,
    snapshot_digest: snapshot.snapshotDigest,
    organization_revision: organizationRevision,
    source: snapshot.source,
  })
})

// @authorization service - 移行元の凍結と業務権限をapplication serviceで再確認する
export const POST = factory.createHandlers(verifyBearer, zValidator("json", request), async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const assignmentId = validateIntParam(c.req.param("id"), "governance assignment adoption")
  const commandId = c.req.header("idempotency-key")
  const expectedRevision = Number(c.req.header("if-match"))
  if (
    commandId === undefined ||
    !/^\S{1,255}$/.test(commandId) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    throw toHttpException(
      new ValidationError("冪等キーと期待会社版が必要です", "governance_role_headers_invalid"),
    )
  }
  const result = await new AdoptGovernanceOrgRoleAssignment({
    context: c,
    prepareAudit: (audit) => prepareGovernanceAudit({ c, ...audit }),
  }).execute({
    session,
    assignmentId,
    commandId,
    expectedRevision,
    snapshotDigest: c.req.valid("json").snapshot_digest,
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  c.header("etag", `"${result.organizationRevision}"`)
  return c.json(result, result.replayed ? 200 : 201)
})
