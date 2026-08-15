import { systemContextModule } from "@system/interface/module"
import type { ApiRouteModuleRegistration } from "@/api/api-route-module"

/** APIへ公開するコンテキストのroute sourceを明示する。 */
export const ROUTE_MODULE_REGISTRY = [
  systemContextModule,
  {
    context: "company",
    tier: "company",
    routesDirectory: "contexts/company/interface/routes",
    routeImportPrefix: "@/contexts/company/interface/routes",
  },
] as const satisfies ReadonlyArray<ApiRouteModuleRegistration>
