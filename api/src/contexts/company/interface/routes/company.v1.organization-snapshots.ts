/** /company/v1/organization-snapshots */
import { readCompanyResources } from "@/contexts/company/application/core/read-company-resources"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { readCompanyResourcesFromD1 } from "@/contexts/company/infrastructure/core/read-company-resources-from-d1"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyInvalidHeadersError,
  CompanyInvalidQueryError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyInvalidHeadersError({ cause: validation.error })
      }
    },
  ),
  zValidator(
    "query",
    z.object({
      id: z
        .union([z.string().regex(/^\S{1,255}$/), z.array(z.string().regex(/^\S{1,255}$/)).max(100)])
        .optional(),
      effective_on: z.string().date().optional(),
      as_of: z.string().date().optional(),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyInvalidQueryError({ cause: validation.error })
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }

    const headers = context.req.valid("header")
    const requestQuery = context.req.valid("query")
    if (
      requestQuery.effective_on !== undefined &&
      requestQuery.as_of !== undefined &&
      requestQuery.effective_on !== requestQuery.as_of
    ) {
      throw new CompanyInvalidQueryError({ detail: "effective_on and as_of must name the same date" })
    }

    const ids =
      requestQuery.id === undefined
        ? []
        : Array.isArray(requestQuery.id)
          ? requestQuery.id
          : [requestQuery.id]
    const effectiveOn = requestQuery.effective_on ?? requestQuery.as_of
    const query = {
      organizationId: headers["x-company-organization-id"],
      types: [
        "organization-unit",
        "assignment",
        "reporting-relation",
        "organizational-authority",
      ] as const,
      ...(ids.length === 0 ? {} : { ids }),
      ...(effectiveOn === undefined ? {} : { effectiveOn: restoreCalendarDate(effectiveOn) }),
    }
    const result = await readCompanyResources(actor, query, (resourceQuery) =>
      readCompanyResourcesFromD1(database, resourceQuery),
    )

    if (result.kind === "invalid") {
      throw new CompanyInvalidQueryError({ cause: result.error })
    }
    if (result.kind === "forbidden") {
      throw new CompanyAccessDeniedError()
    }
    if (result.kind === "unavailable") {
      throw new CompanyReadUnavailableError({ cause: result.cause })
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId: query.organizationId,
        organizationRevision: result.organizationRevision,
        resources: result.resources,
      },
      200,
    )
  },
)
