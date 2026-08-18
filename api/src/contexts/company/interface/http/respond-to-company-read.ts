import type { ReadCompanyResourcesResult } from "@/contexts/company/application/core/read-company-resources"
import type { CompanyHttpContext } from "@/contexts/company/interface/http/company-http-environment"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"

export function respondToCompanyRead(
  context: CompanyHttpContext,
  organizationId: string,
  result: ReadCompanyResourcesResult,
) {
  if (result.kind === "invalid") {
    return createCompanyProblem(context, 400, "invalid_company_query", "Company query is invalid")
  }
  if (result.kind === "forbidden") {
    return createCompanyProblem(
      context,
      403,
      "company_access_denied",
      "Company scope or capability is missing",
    )
  }
  if (result.kind === "unavailable") {
    return createCompanyProblem(
      context,
      503,
      "company_read_unavailable",
      "Company data could not be read",
    )
  }
  context.header("etag", `"${result.organizationRevision}"`)
  return context.json(
    {
      organizationId,
      organizationRevision: result.organizationRevision,
      resources: result.resources,
    },
    200,
  )
}
