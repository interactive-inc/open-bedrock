import { systemContextModule } from "@system/interface/module"

export type RouteModuleRegistration = Readonly<{
  context: string
  tier: "system" | "company" | "business"
  routesDirectory: string
  routeImportPrefix: string
}>

/** APIへ公開するコンテキストのroute sourceを明示する。 */
export const ROUTE_MODULE_REGISTRY = [
  systemContextModule,
  {
    context: "company",
    tier: "company",
    routesDirectory: "contexts/company/interface/routes",
    routeImportPrefix: "@/contexts/company/interface/routes",
  },
] as const satisfies ReadonlyArray<RouteModuleRegistration>
