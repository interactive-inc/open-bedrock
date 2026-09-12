import { CompanyChangeFeedRepository } from "@/contexts/company/infrastructure/repositories/core/company-change-feed.repository"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { CompanyChangeCursorValue } from "@/contexts/company/domain/values/company-change-cursor.value"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - 指定会社のcompany:readで全資源の変更位置を取得する
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "query",
    z.strictObject({
      cursor: z.string().max(4096).optional(),
      through_revision: z.coerce
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER)
        .optional(),
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
    const query = context.req.valid("query")
    const cursor = CompanyChangeCursorValue.restore(query.cursor, organizationId)
    if (cursor instanceof Error) throw new CompanyQueryInvalidError(cursor)
    const page = await new CompanyChangeFeedRepository(context.env.DB).list({
      organizationId,
      afterRevision: cursor.props.revision,
      afterType: cursor.props.type,
      afterId: cursor.props.id,
      afterResourceRevision: cursor.props.resourceRevision,
      throughRevision: query.through_revision ?? null,
      limit: query.limit,
    })
    if (page instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(page)
    if (page instanceof Error) throw new CompanyReadUnavailableError(page)
    return context.json({
      data: page.changes,
      through_revision: page.throughRevision,
      has_more: page.hasMore,
      next_cursor: JSON.stringify(page.next),
    })
  },
)
