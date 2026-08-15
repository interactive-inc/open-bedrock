import { describe, expect, test } from "bun:test"
import {
  inspectApiRouteModuleRegistry,
  type ApiRouteModuleRegistration,
} from "@/api/api-route-module"

const validRegistry = [
  {
    context: "system",
    tier: "system",
    routesDirectory: "contexts/system/interface/routes",
    routeImportPrefix: "@system/interface/routes",
  },
  {
    context: "company",
    tier: "company",
    routesDirectory: "contexts/company/interface/routes",
    routeImportPrefix: "@/contexts/company/interface/routes",
  },
] as const satisfies ReadonlyArray<ApiRouteModuleRegistration>

describe("inspectApiRouteModuleRegistry", () => {
  test("accepts a System > Company > Business registry", () => {
    expect(
      inspectApiRouteModuleRegistry([
        ...validRegistry,
        {
          context: "example",
          tier: "business",
          routesDirectory: "contexts/example/interface/routes",
          routeImportPrefix: "@/contexts/example/interface/routes",
        },
      ]),
    ).toEqual([])
  })

  test("rejects duplicate contexts and route sources", () => {
    expect(inspectApiRouteModuleRegistry([...validRegistry, validRegistry[1]])).toEqual([
      "contextが重複しています: company",
      "companyのtierは登録順3ではbusinessである必要があります",
      "routes directoryが重複しています: contexts/company/interface/routes",
      "route import prefixが重複しています: @/contexts/company/interface/routes",
    ])
  })

  test("rejects invalid ownership and tier order", () => {
    expect(
      inspectApiRouteModuleRegistry([
        {
          context: "System",
          tier: "company",
          routesDirectory: "routes/system",
          routeImportPrefix: "@/routes/system",
        },
      ]),
    ).toEqual([
      "不正なcontext名です: System",
      "Systemのtierは登録順1ではsystemである必要があります",
      "Systemのroutes directoryが所有contextと一致しません: routes/system",
      "Systemのroute import prefixが所有contextと一致しません: @/routes/system",
      "registryの先頭はsystemである必要があります",
      "registryの2番目はcompanyである必要があります",
    ])
  })
})
