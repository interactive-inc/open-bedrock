/** /company/v1/organization-snapshots */
import { readCompanyResources } from "@/contexts/company/application/core/read-company-resources"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { readCompanyResourcesFromD1 } from "@/contexts/company/infrastructure/core/read-company-resources-from-d1"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"
import { readCompanyRequestRuntime } from "@/contexts/company/interface/http/read-company-request-runtime"
import { respondToCompanyRead } from "@/contexts/company/interface/http/respond-to-company-read"
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
  ),
  async (context) => {
    const runtime = readCompanyRequestRuntime(context)
    if ("status" in runtime) {
      return createCompanyProblem(context, runtime.status, runtime.code, runtime.detail)
    }

    const headers = context.req.valid("header")
    const requestQuery = context.req.valid("query")
    if (
      requestQuery.effective_on !== undefined &&
      requestQuery.as_of !== undefined &&
      requestQuery.effective_on !== requestQuery.as_of
    ) {
      return createCompanyProblem(
        context,
        400,
        "invalid_company_query",
        "effective_on and as_of must name the same date",
      )
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
    const result = await readCompanyResources(runtime.actor, query, (resourceQuery) =>
      readCompanyResourcesFromD1(runtime.database, resourceQuery),
    )

    return respondToCompanyRead(context, query.organizationId, result)
  },
)
