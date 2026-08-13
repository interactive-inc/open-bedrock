import { systemContextModule } from "@system/interface/module"

export type RouteModuleRegistration = Readonly<{
  context: string
  routesDirectory: string
  importPrefix: string
}>

/** APIへ公開するコンテキストのroute sourceを明示する。 */
export const ROUTE_MODULE_REGISTRY = [
  systemContextModule,
  {
    context: "company",
    routesDirectory: "contexts/company/interface/routes",
    importPrefix: "@/contexts/company/interface/routes",
  },
  {
    context: "legacy",
    routesDirectory: "interface/routes",
    importPrefix: "@/interface/routes",
  },
] as const satisfies ReadonlyArray<RouteModuleRegistration>
