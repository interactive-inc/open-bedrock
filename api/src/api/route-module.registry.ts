export type RouteModuleRegistration = Readonly<{
  context: string
  routesDirectory: string
  importPrefix: string
}>

/** APIへ公開するコンテキストのroute sourceを明示する。 */
export const ROUTE_MODULE_REGISTRY = [
  {
    context: "system",
    routesDirectory: "contexts/system/interface/routes",
    importPrefix: "@/contexts/system/interface/routes",
  },
  {
    context: "legacy",
    routesDirectory: "interface/routes",
    importPrefix: "@/interface/routes",
  },
] as const satisfies ReadonlyArray<RouteModuleRegistration>
