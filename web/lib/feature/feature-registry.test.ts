import { describe, expect, test } from "vite-plus/test"
import { featureRegistry } from "@/lib/feature/feature-registry"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"

describe("featureRegistry", () => {
  test("keeps one definition per feature and one owner per route", () => {
    const featureSlugs = featureRegistry.map((feature) => feature.slug)
    const featureRoutes = featureRegistry.flatMap((feature) =>
      feature.routes.map((route) => `${route.space}:${route.href}`),
    )

    expect(new Set(featureSlugs).size).toBe(featureSlugs.length)
    expect(new Set(featureRoutes).size).toBe(featureRoutes.length)
  })

  test("requires every feature to expose at least one navigation route", () => {
    expect(featureRegistry.every((feature) => feature.routes.length > 0)).toBe(true)
  })

  test("does not expose retirement candidates as navigation items", () => {
    const organizationItems = getFeatureNavigationItems("organization", null)

    expect(
      organizationItems.some((navigationItem) => navigationItem.slug === "management-dashboard"),
    ).toBe(false)
  })

  test("resolves department route placeholders without changing the registry", () => {
    const departmentItems = getFeatureNavigationItems("teams", "D001")
    const memberItem = departmentItems.find(
      (navigationItem) => navigationItem.slug === "team-management",
    )

    expect(memberItem?.href).toBe("/teams/reports")
    expect(
      departmentItems.some((navigationItem) => navigationItem.href === "/teams/D001/members"),
    ).toBe(true)
  })
})
