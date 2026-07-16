import {
  canManageGovernance,
  canPublishGovernance,
  canReadGovernance,
  canReadGovernanceDocument,
  canReviewGovernance,
} from "@/application/governance/governance-access"
import { GovernanceRepository } from "@/infrastructure/governance/governance-repository"
import { factory } from "@/lib/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toGovernanceDocumentResponse } from "@/interface/governance/governance-route-shared"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const elevated =
    canManageGovernance(session) || canReviewGovernance(session) || canPublishGovernance(session)
  if (!canReadGovernance(session) && !elevated) throw new ForbiddenError()

  const records = await new GovernanceRepository(c).listDocuments(elevated)
  if (records instanceof Error) throw new InternalError("failed to list governance documents")
  const access = await Promise.all(
    records.map(async (record) => ({
      record,
      allowed:
        record.version !== null &&
        (await canReadGovernanceDocument({
          c,
          session,
          metadata: record.version.metadata,
          isDraft: record.version.row.state !== "published",
        })),
    })),
  )
  if (access.some((item) => item.allowed instanceof Error)) {
    throw new InternalError("failed to resolve governance audience")
  }
  const q = (c.req.query("q") ?? "").trim().toLocaleLowerCase("ja")
  const kind = c.req.query("kind") ?? null
  const data = access
    .filter((item) => item.allowed === true)
    .map((item) => toGovernanceDocumentResponse(item.record, { includeSource: elevated }))
    .filter((item) => item !== null)
    .filter((item) => kind === null || item.kind === kind)
    .filter(
      (item) =>
        q === "" ||
        item.title.toLocaleLowerCase("ja").includes(q) ||
        item.body_md.toLocaleLowerCase("ja").includes(q),
    )
    .map((item) => ({
      ...item,
      body_md: undefined,
      metadata: undefined,
      approvals: undefined,
      references: undefined,
    }))
  return c.json({ data, total: data.length }, 200)
})
