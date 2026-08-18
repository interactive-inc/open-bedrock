import { writeEmployments } from "@/contexts/company/application/employments/write-employments"
import { writeCompanyResourcesToD1 } from "@/contexts/company/infrastructure/core/write-company-resources-to-d1"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { companyWriteHeaderSchema } from "@/contexts/company/interface/http/company-write-header-schema"
import { employmentsCompanyWriteRequestSchema } from "@/contexts/company/interface/http/requests/employments-company-write-request-schema"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"
import { readCompanyRequestRuntime } from "@/contexts/company/interface/http/read-company-request-runtime"
import { respondToCompanyWrite } from "@/contexts/company/interface/http/respond-to-company-write"
import { toCompanyResourceChange } from "@/contexts/company/interface/http/to-company-resource-change"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const POST = factory.createHandlers(
  zValidator("header", companyWriteHeaderSchema, (result, context) => {
    if (!result.success) {
      return createCompanyProblem(
        context,
        400,
        "company_write_precondition_required",
        "organization, idempotency-key, and if-match revision are required",
      )
    }
  }),
  zValidator("json", employmentsCompanyWriteRequestSchema, (result, context) => {
    if (!result.success) {
      return createCompanyProblem(
        context,
        422,
        "invalid_company_change",
        "Company change is invalid",
      )
    }
  }),
  async (context) => {
    const runtime = readCompanyRequestRuntime(context)
    if ("status" in runtime) {
      return createCompanyProblem(context, runtime.status, runtime.code, runtime.detail)
    }
    const change = toCompanyResourceChange(
      context.req.valid("header"),
      context.req.valid("json"),
      Date.now(),
    )
    if (change === null) {
      return createCompanyProblem(
        context,
        422,
        "invalid_company_resource",
        "A Company resource is outside the requested organization",
      )
    }
    const result = await writeEmployments(runtime.actor, change, (resourceChange) =>
      writeCompanyResourcesToD1(runtime.database, resourceChange),
    )
    return respondToCompanyWrite(context, change.resources[0]?.organizationId ?? "", result)
  },
)
