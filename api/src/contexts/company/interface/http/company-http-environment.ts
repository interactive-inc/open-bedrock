import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type { Context } from "hono"

export type CompanyHttpEnvironment = {
  Bindings: { DB?: D1Database }
  Variables: { companyActor?: CompanyActor }
}

export type CompanyHttpContext = Context<CompanyHttpEnvironment>
