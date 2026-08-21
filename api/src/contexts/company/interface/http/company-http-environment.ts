import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { Context } from "hono"

export type CompanyHttpEnvironment = {
  Bindings: { DB?: D1Database }
  Variables: { companyActor?: CompanyActorValue }
}

export type CompanyHttpContext = Context<CompanyHttpEnvironment>
