import { toFeatureSpace } from "@/lib/routing/to-feature-space"
import { describe, expect, test } from "vite-plus/test"

describe("toFeatureSpace", () => {
  test("ホームは本人の空間にする", () => {
    expect(toFeatureSpace("/")).toBe("apps")
  })

  test("所属データと横断画面を分離する", () => {
    expect(toFeatureSpace("/expense/expenses")).toBe("apps")
    expect(toFeatureSpace("/company/departments/D001")).toBe("company")
    expect(toFeatureSpace("/approval-delegations")).toBe("composition")
    expect(toFeatureSpace("/inbox")).toBe("composition")
    expect(toFeatureSpace("/notifications/new")).toBe("composition")
    expect(toFeatureSpace("/application-templates/example/workflow?mode=edit")).toBe("composition")
    expect(toFeatureSpace("/system/audit-events")).toBe("system")
    expect(toFeatureSpace("/audit-events/example")).toBe("composition")
  })

  test("所有者 prefix を持つ URL はその所有者の空間にする", () => {
    expect(toFeatureSpace("/system/accounts")).toBe("system")
    expect(toFeatureSpace("/company/employee-directory")).toBe("company")
  })

  test("context 名で始まる App の全社ビューは業務の空間にする", () => {
    expect(toFeatureSpace("/expense/expenses")).toBe("apps")
    expect(toFeatureSpace("/dashboards/management")).toBe("composition")
  })

  test("prefix の一致は segment 単位で見る", () => {
    expect(toFeatureSpace("/mycompany/things")).toBe("apps")
    expect(toFeatureSpace("/teamsync/things")).toBe("apps")
  })
})
