import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { CompanyResourceHistoryRepository } from "@/contexts/company/infrastructure/repositories/core/company-resource-history.repository"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"

const factory = createFactory<CompanyHttpEnvironment>()
const revision = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))

// @authorization service - 指定会社のcompany:readで属性・原資料を含む資源履歴を取得する
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "param",
    z.object({
      type: z.enum(companyResourceTypes),
      id: z.string().regex(/^\S{1,255}$/),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  zValidator(
    "query",
    z.strictObject({
      after_revision: revision.default(0),
      through_revision: revision.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const organizationId = context.req.valid("header")["x-company-organization-id"]
    if (!actor.canAccessOrganization(organizationId) || !actor.hasCapability("company:read"))
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const { type, id } = context.req.valid("param")
    const query = context.req.valid("query")
    const page = await new CompanyResourceHistoryRepository(context.env.DB).list({
      organizationId,
      type,
      id,
      afterRevision: query.after_revision,
      throughRevision: query.through_revision ?? null,
      limit: query.limit,
    })
    if (page instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(page)
    if (page instanceof Error) throw new CompanyReadUnavailableError(page)
    context.header("etag", `"${page.throughRevision}"`)
    return context.json({
      organizationId,
      resourceType: type,
      resourceId: id,
      throughRevision: page.throughRevision,
      data: page.data,
      hasMore: page.hasMore,
      nextAfterRevision: page.nextAfterRevision,
    })
  },
)
