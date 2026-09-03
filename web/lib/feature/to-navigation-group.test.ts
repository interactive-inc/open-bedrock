import { describe, expect, test } from "vite-plus/test"
import { toNavigationGroup } from "@/lib/feature/to-navigation-group"

describe("toNavigationGroup", () => {
  test("部署スコープの route は feature の group によらず部署セクションへ寄せる", () => {
    expect(toNavigationGroup("/teams/:team/attendances", "time")).toBe("team")
    expect(toNavigationGroup("/teams/:team/goals", "growth")).toBe("team")
    expect(toNavigationGroup("/teams/approval-delegations", "requests")).toBe("team")
  })

  test("同じ feature でも本人スコープの route は feature の group を保つ", () => {
    expect(toNavigationGroup("/my/attendances", "time")).toBe("time")
    expect(toNavigationGroup("/my/goals", "growth")).toBe("growth")
  })

  test("所有者 prefix を持つ route も feature の group を保つ", () => {
    expect(toNavigationGroup("/company/employees", "company-people")).toBe("company-people")
    expect(toNavigationGroup("/system/accounts", "system")).toBe("system")
    expect(toNavigationGroup("/", "overview")).toBe("overview")
  })

  test("prefix の一致は segment 単位で見る", () => {
    expect(toNavigationGroup("/teamsync/things", "time")).toBe("time")
  })
})
