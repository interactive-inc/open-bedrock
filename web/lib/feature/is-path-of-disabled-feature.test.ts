import { describe, expect, test } from "vite-plus/test"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"
import { isPathOfDisabledFeature } from "@/lib/feature/is-path-of-disabled-feature"

describe("isPathOfDisabledFeature", () => {
  test("matches the feature page and its sub paths", () => {
    expect(isPathOfDisabledFeature("/organization/thanks", ["thanks"])).toBe(true)
    expect(isPathOfDisabledFeature("/my/thanks", ["thanks"])).toBe(true)
    expect(isPathOfDisabledFeature("/organization/thanks-redemptions", ["thanks"])).toBe(true)
  })

  test("does not match other features or plain prefixes", () => {
    expect(isPathOfDisabledFeature("/organization/thanks", ["one-on-ones"])).toBe(false)
    expect(isPathOfDisabledFeature("/organization/employees", ["thanks"])).toBe(false)
    expect(isPathOfDisabledFeature("/", ["thanks", "one-on-ones"])).toBe(false)
  })

  test("resolves dynamic segments in hrefs", () => {
    const teamRoutes = getFeatureNavigationItems("teams", "D003")

    const oneOnOneRoute = teamRoutes.find((item) => item.slug === "one-on-ones")

    if (oneOnOneRoute !== undefined) {
      expect(isPathOfDisabledFeature(oneOnOneRoute.href, ["one-on-ones"])).toBe(true)
    }

    expect(isPathOfDisabledFeature("/teams/D003/members", ["one-on-ones"])).toBe(false)
  })

  test("an empty disabled list never matches", () => {
    expect(isPathOfDisabledFeature("/organization/thanks", [])).toBe(false)
  })
})

describe("getFeatureNavigationItems with disabled features", () => {
  test("drops navigation items of disabled features", () => {
    const allItems = getFeatureNavigationItems("organization", null)
    const filteredItems = getFeatureNavigationItems("organization", null, ["thanks"])

    expect(allItems.some((item) => item.slug === "thanks")).toBe(true)
    expect(filteredItems.some((item) => item.slug === "thanks")).toBe(false)
    expect(filteredItems.length).toBeLessThan(allItems.length)
  })
})
