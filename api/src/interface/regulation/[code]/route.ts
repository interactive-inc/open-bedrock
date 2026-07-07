import { factory } from "@/lib/factory"
import { RegulationRepository } from "@/infrastructure/regulation/regulation-repository"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppRegulationDetail } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import type { RegulationVersion } from "@/domain/regulation/regulation-version.entity"

// GET /regulations/:code — 規程1件（最新版＋版一覧、全認証者）。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "regulation")

  const regulationRepository = new RegulationRepository(c)

  const regulation = await regulationRepository.findByCode(code)

  if (regulation instanceof Error) {
    throw new InternalError("failed to load regulation")
  }

  if (regulation === null || regulation.id === null) {
    throw new NotFoundError("regulation not found")
  }

  const versions = await regulationRepository.listVersions(regulation.id)

  if (versions instanceof Error) {
    throw new InternalError("failed to load regulation versions")
  }

  const latest = versions.at(0) ?? null

  const responseBody = zAppRegulationDetail.parse({
    id: regulation.id,
    code: regulation.code,
    title: regulation.title,
    category: regulation.category,
    status: regulation.status,
    created_at: regulation.createdAt,
    latest_version: latest === null ? null : toVersionResponse(latest),
    versions: versions.map((version) => toVersionResponse(version)),
  })

  return c.json(responseBody, 200)
})

function toVersionResponse(version: RegulationVersion) {
  return {
    id: version.id,
    version: version.version,
    body_md: version.bodyMd,
    effective_on: version.effectiveOn,
    note: version.note,
    created_at: version.createdAt,
  }
}
