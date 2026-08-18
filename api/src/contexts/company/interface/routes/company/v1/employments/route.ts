import { readEmployments } from "@/contexts/company/application/employments/read-employments"
import { readCompanyResourcesFromD1 } from "@/contexts/company/infrastructure/core/read-company-resources-from-d1"
import { companyReadHeaderSchema } from "@/contexts/company/interface/http/company-read-header-schema"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { companyReadQuerySchema } from "@/contexts/company/interface/http/company-read-query-schema"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"
import { readCompanyRequestRuntime } from "@/contexts/company/interface/http/read-company-request-runtime"
import { respondToCompanyRead } from "@/contexts/company/interface/http/respond-to-company-read"
import { toCompanyReadQuery } from "@/contexts/company/interface/http/to-company-read-query"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const GET = factory.createHandlers(
  zValidator("header", companyReadHeaderSchema, (result, context) => {
    if (!result.success) {
      return createCompanyProblem(
        context,
        400,
        "organization_id_required",
        "x-company-organization-id must contain an opaque organization ID",
      )
    }
  }),
  zValidator("query", companyReadQuerySchema, (result, context) => {
    if (!result.success) {
      return createCompanyProblem(context, 400, "invalid_company_query", "Company query is invalid")
    }
  }),
  async (context) => {
    const runtime = readCompanyRequestRuntime(context)
    if ("status" in runtime) {
      return createCompanyProblem(context, runtime.status, runtime.code, runtime.detail)
    }
    const query = toCompanyReadQuery(context.req.valid("header"), context.req.valid("query"))
    const result = await readEmployments(runtime.actor, query, (resourceQuery) =>
      readCompanyResourcesFromD1(runtime.database, resourceQuery),
    )
    return respondToCompanyRead(context, query.organizationId, result)
  },
)
