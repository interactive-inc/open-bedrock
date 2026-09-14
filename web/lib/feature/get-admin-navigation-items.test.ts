import { describe, expect, test } from "vite-plus/test"
import { featureRegistry } from "@/lib/feature/feature-registry"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"

describe("管理ナビゲーション", () => {
  test("権限のない管理操作は表示しない", () => {
    const paths = getAdminNavigationItems([], []).map((item) => item.href)
    expect(paths).not.toContain("/system/accounts")
    expect(paths).not.toContain("/notifications/new")
    expect(paths).not.toContain("/thanks/rewards/manage")
  })

  test("本人・チーム専用ページを登録しない", () => {
    const retired = featureRegistry
      .flatMap((feature) => feature.routes)
      .filter((route) => route.href === "/" || /^\/(my|teams)(\/|$)/.test(route.href))
    expect(retired).toEqual([])
  })

  test("管理権限と無効化設定の両方を反映する", () => {
    const permissions = ["notification:send", "thanks_reward:manage"]
    const items = getAdminNavigationItems(permissions, [])
    expect(items.some((item) => item.href === "/notifications/new")).toBe(true)
    const reward = items.find((item) => item.href === "/thanks/rewards/manage")
    expect(reward).toBeDefined()
    expect(
      getAdminNavigationItems(permissions, [reward!.slug]).some(
        (item) => item.href === reward!.href,
      ),
    ).toBe(false)
  })

  test("System・Company・業務と横断を分離する", () => {
    expect(toFeatureSpace("/system/accounts")).toBe("system")
    expect(toFeatureSpace("/approval-delegations")).toBe("composition")
    expect(toFeatureSpace("/company/departments/D001")).toBe("company")
    expect(toFeatureSpace("/attendance/attendances")).toBe("apps")
  })
})
