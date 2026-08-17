import { systemContextModule } from "@system/interface/module"
import { companyContextModule } from "@/contexts/company/interface/module"
import type { ApiRouteModuleRegistration } from "@/api/api-route-module"

const BUSINESS_CONTEXTS: ReadonlyArray<string> = [
  "company-compatibility",
  "announcement",
  "antisocial-check",
  "asset",
  "attendance",
  "business-trip",
  "career",
  "certificate-request",
  "certification",
  "commendation",
  "company-calendar",
  "compensation-change",
  "disciplinary-action",
  "document",
  "expense",
  "family-care-leave",
  "governance",
  "headcount-plan",
  "health-checkup",
  "it-incident",
  "knowledge",
  "leave",
  "life-event",
  "meeting",
  "onboarding",
  "one-on-one",
  "partner",
  "performance-review",
  "recruitment",
  "regulation",
  "rental",
  "resignation",
  "ringi",
  "room",
  "shift",
  "skill",
  "software-license",
  "survey",
  "thanks",
  "training",
  "work-accident",
  "work-style",
]

const businessContextModules: ReadonlyArray<ApiRouteModuleRegistration> = BUSINESS_CONTEXTS.map(
  (context) => ({
    context,
    tier: "business",
    routesDirectory: `contexts/${context}/interface/routes`,
    routeImportPrefix: `@/contexts/${context}/interface/routes`,
  }),
)

/** APIへ公開するコンテキストのroute sourceを明示する。 */
export const ROUTE_MODULE_REGISTRY = [
  systemContextModule,
  companyContextModule,
  ...businessContextModules,
  {
    context: "api",
    tier: "composition",
    routesDirectory: "api/routes",
    routeImportPrefix: "@/api/routes",
  },
] satisfies ReadonlyArray<ApiRouteModuleRegistration>
