import { toNavigationGroup } from "@/lib/feature/to-navigation-group"
import { describe, expect, test } from "vite-plus/test"

describe("toNavigationGroup", () => {
  test("部署情報は会社の組織、代理承認はSystemの案件と判断へ寄せる", () => {
    expect(toNavigationGroup("/company/departments/D001", "team")).toBe("company-organization")
    expect(toNavigationGroup("/system/approval-delegations", "requests")).toBe("system-case")
  })

  test("業務の管理一覧は feature の group を保つ", () => {
    expect(toNavigationGroup("/attendance/attendances", "time")).toBe("time")
    expect(toNavigationGroup("/performance-review/goals", "growth")).toBe("growth")
  })

  test("汎用手続きは System 空間の「案件と判断」へ寄せる", () => {
    expect(toNavigationGroup("/inbox", "requests")).toBe("cross-context")
    expect(toNavigationGroup("/application-templates", "requests")).toBe("cross-context")
    expect(toNavigationGroup("/system/applications", "requests")).toBe("system-case")
  })

  test("所有者 prefix を持つ route も feature の group を保つ", () => {
    expect(toNavigationGroup("/company/employees", "company-people")).toBe("company-people")
    expect(toNavigationGroup("/system/accounts", "system")).toBe("system")
    expect(toNavigationGroup("/", "overview")).toBe("overview")
  })

  test("通知作成はSystemの非同期処理へ寄せる", () => {
    expect(toNavigationGroup("/notifications/new", "system")).toBe("system-async")
  })
})
