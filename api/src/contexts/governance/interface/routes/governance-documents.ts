import { GovernanceAccessAdapter } from "@/contexts/governance/infrastructure/adapters/governance-access.adapter"
import { GovernanceAdapter } from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { factory } from "@/api/http/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toGovernanceDocumentResponse } from "@/contexts/governance/interface/http/governance-documents/to-governance-document-response"

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const governanceAccess = new GovernanceAccessAdapter({ context: c, session })
  const elevated =
    governanceAccess.canManage() || governanceAccess.canReview() || governanceAccess.canPublish()
  if (!governanceAccess.canRead() && !elevated) throw new ForbiddenError()

  const records = await new GovernanceAdapter(c).listDocuments(elevated)
  if (records instanceof Error) throw new InternalError("failed to list governance documents")
  const access = await Promise.all(
    records.map(async (record) => ({
      record,
      allowed:
        record.version !== null &&
        (await governanceAccess.canReadDocument({
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
