import { toNavigationGroup } from "@/lib/feature/to-navigation-group"
import { describe, expect, test } from "vite-plus/test"

describe("toNavigationGroup", () => {
  test("部署情報は会社の組織、代理承認は横断へ寄せる", () => {
    expect(toNavigationGroup("/company/departments/D001", "team")).toBe("company-organization")
    expect(toNavigationGroup("/approval-delegations", "requests")).toBe("cross-context")
  })

  test("業務の管理一覧は feature の group を保つ", () => {
    expect(toNavigationGroup("/attendance/attendances", "time")).toBe("time")
    expect(toNavigationGroup("/performance-review/goals", "growth")).toBe("growth")
  })

  test("会社資格と組み合わせる手続きは横断へ寄せる", () => {
    expect(toNavigationGroup("/inbox", "requests")).toBe("cross-context")
    expect(toNavigationGroup("/application-templates", "requests")).toBe("cross-context")
    expect(toNavigationGroup("/applications", "requests")).toBe("cross-context")
  })

  test("所有者 prefix を持つ route も feature の group を保つ", () => {
    expect(toNavigationGroup("/company/employee-directory", "company-people")).toBe(
      "company-people",
    )
    expect(toNavigationGroup("/system/accounts", "system")).toBe("system")
    expect(toNavigationGroup("/", "overview")).toBe("overview")
  })

  test("会社の宛先と組み合わせる通知作成は横断へ寄せる", () => {
    expect(toNavigationGroup("/notifications/new", "system")).toBe("cross-context")
  })
})
