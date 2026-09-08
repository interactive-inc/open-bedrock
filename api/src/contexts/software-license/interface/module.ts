import { softwareLicenseRouteManifest } from "@/contexts/software-license/interface/route-manifest"

/** サービス利用台帳のroute所有境界。 */
export const softwareLicenseContextModule = {
  context: "software-license",
  tier: "business",
  routesDirectory: "contexts/software-license/interface/routes",
  routeImportPrefix: "@/contexts/software-license/interface/routes",
  routes: softwareLicenseRouteManifest,
} as const
