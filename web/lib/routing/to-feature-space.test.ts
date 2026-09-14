import { toFeatureSpace } from "@/lib/routing/to-feature-space"
import { describe, expect, test } from "vite-plus/test"

describe("toFeatureSpace", () => {
  test("ホームは本人の空間にする", () => {
    expect(toFeatureSpace("/")).toBe("apps")
  })

  test("本人スコープと部署スコープ、受信箱と通知を本人の空間にする", () => {
    expect(toFeatureSpace("/expense/expenses")).toBe("apps")
    expect(toFeatureSpace("/company/departments/D001")).toBe("company")
    expect(toFeatureSpace("/system/approval-delegations")).toBe("system")
    expect(toFeatureSpace("/inbox")).toBe("system")
    expect(toFeatureSpace("/notifications/new")).toBe("system")
  })

  test("所有者 prefix を持つ URL はその所有者の空間にする", () => {
    expect(toFeatureSpace("/system/accounts")).toBe("system")
    expect(toFeatureSpace("/company/employees")).toBe("company")
  })

  test("context 名で始まる App の全社ビューは業務の空間にする", () => {
    expect(toFeatureSpace("/expense/expenses")).toBe("apps")
    expect(toFeatureSpace("/dashboards/management")).toBe("apps")
  })

  test("prefix の一致は segment 単位で見る", () => {
    expect(toFeatureSpace("/mycompany/things")).toBe("apps")
    expect(toFeatureSpace("/teamsync/things")).toBe("apps")
  })
})
