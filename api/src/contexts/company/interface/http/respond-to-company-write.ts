import type { WriteCompanyResourcesResult } from "@/contexts/company/application/core/write-company-resources"
import type { CompanyHttpContext } from "@/contexts/company/interface/http/company-http-environment"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"

export function respondToCompanyWrite(
  context: CompanyHttpContext,
  organizationId: string,
  result: WriteCompanyResourcesResult,
) {
  if (result.kind === "forbidden") {
    return createCompanyProblem(
      context,
      403,
      "company_access_denied",
      "Company scope or capability is missing",
    )
  }
  if (result.kind === "invalid") {
    return createCompanyProblem(
      context,
      422,
      result.error.code,
      "Company invariant validation failed",
    )
  }
  if (result.kind === "conflict") {
    context.header("etag", `"${result.actualRevision}"`)
    return createCompanyProblem(
      context,
      409,
      "company_revision_conflict",
      "Company revision has changed",
    )
  }
  if (result.kind === "resource_conflict") {
    return createCompanyProblem(
      context,
      409,
      "company_resource_conflict",
      "Resource revision has changed",
    )
  }
  if (result.kind === "command_conflict") {
    return createCompanyProblem(
      context,
      409,
      "company_command_conflict",
      "Idempotency key was reused",
    )
  }
  if (result.kind === "unavailable") {
    return createCompanyProblem(
      context,
      503,
      "company_write_unavailable",
      "Company change was not applied",
    )
  }
  context.header("etag", `"${result.organizationRevision}"`)
  return context.json(
    {
      organizationId,
      organizationRevision: result.organizationRevision,
      replayed: result.replayed,
    },
    result.replayed ? 200 : 201,
  )
}
