import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import type { CompanyHttpInputError } from "@/contexts/company/interface/http/company-http-input-error"
import type { Context } from "hono"

export type CompanyRequestRuntime = Readonly<{
  actor: CompanyActor
  database: D1Database
}>

export function readCompanyRequestRuntime(
  context: Context<CompanyHttpEnvironment>,
): CompanyRequestRuntime | CompanyHttpInputError {
  const actor = context.var.companyActor
  if (actor === undefined) {
    return {
      status: 401,
      code: "authentication_required",
      detail: "Authentication is required",
    }
  }
  const database = context.env.DB
  if (database === undefined) {
    return {
      status: 503,
      code: "company_database_unavailable",
      detail: "Company storage is unavailable",
    }
  }
  return { actor, database }
}
