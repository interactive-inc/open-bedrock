import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarProvider } from "@/components/ui/sidebar"
import { featureRegistry } from "@/lib/feature/feature-registry"

const pathnameMock = vi.fn<() => string>(() => "/")

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={prefetch === undefined ? "undefined" : String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))

const inboxCounts = { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }

/** admin 相当。registry が要求する permission をすべて持つ。 */
const allPermissions = featureRegistry.flatMap((feature) =>
  feature.routes.flatMap((route) => {
    if (route.visibility.kind === "permission") return [route.visibility.permission]

    if (route.visibility.kind === "everyone") return []

    return route.visibility.permissions
  }),
)

afterEach(() => {
  cleanup()

  pathnameMock.mockReturnValue("/")
})

describe("SidebarNav audit entry", () => {
  test("shows a no-prefetch audit link only with live audit:read permission", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["audit:read"])

    const link = screen.getByRole("link", { name: "監査ログ" })
    expect(link.getAttribute("href")).toBe("/system/audit-events")
    expect(link.getAttribute("data-prefetch")).toBe("false")
  })

  test("hides the audit entry without read permission", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["audit:export", "batch:view"])

    expect(screen.queryByRole("link", { name: "監査ログ" })).toBeNull()
  })

  test("does not change the existing prefetch behavior of unrelated links", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["batch:view"])

    expect(screen.getByRole("link", { name: "バッチ" }).getAttribute("data-prefetch")).toBe(
      "undefined",
    )
  })
})

describe("SidebarNav governance entry", () => {
  test("shows the governance link only to readers", () => {
    pathnameMock.mockReturnValue("/governance/governance-documents")

    renderSidebar(["governance:read"])

    expect(screen.getByRole("link", { name: "規程・手続き" }).getAttribute("href")).toBe(
      "/governance/governance-documents",
    )
  })

  test("hides the governance link without governance:read", () => {
    pathnameMock.mockReturnValue("/company/employees")

    renderSidebar([])

    expect(screen.queryByRole("link", { name: "規程・手続き" })).toBeNull()
  })
})

describe("SidebarNav team entry (requiredAnyPermission)", () => {
  test("shows マイチーム in the company space with any one of the scope permissions", () => {
    pathnameMock.mockReturnValue("/company/reports")

    renderSidebar(["leave:read:reports"])

    expect(screen.getByRole("link", { name: "マイチーム" }).getAttribute("href")).toBe(
      "/company/reports",
    )
  })

  test("shows マイチーム with a different single scope permission", () => {
    pathnameMock.mockReturnValue("/company/reports")

    renderSidebar(["goal:read:reports"])

    expect(screen.getByRole("link", { name: "マイチーム" })).toBeTruthy()
  })

  test("hides マイチーム when none of the scope permissions are held", () => {
    pathnameMock.mockReturnValue("/company/reports")

    renderSidebar(["employee:create"])

    expect(screen.queryByRole("link", { name: "マイチーム" })).toBeNull()
  })
})

describe("SidebarNav workflow-repairs entry (requiredAllPermissions)", () => {
  test("shows only when both required permissions are held", () => {
    pathnameMock.mockReturnValue("/system/workflow-repairs")

    renderSidebar(["application:read:all", "application_template:manage"])

    expect(screen.getByRole("link", { name: "ワークフロー修復" }).getAttribute("href")).toBe(
      "/system/workflow-repairs",
    )
  })

  test("hides when only one required permission is held", () => {
    pathnameMock.mockReturnValue("/company/employees")

    renderSidebar(["application:read:all"])

    expect(screen.queryByRole("link", { name: "ワークフロー修復" })).toBeNull()
  })
})

describe("SidebarNav space tabs", () => {
  test("hides the system tab when no system permission is held", () => {
    renderSidebar([])

    expect(screen.queryByRole("tab", { name: "システム" })).toBeNull()
  })

  test("shows the system tab with a system permission", () => {
    renderSidebar(["batch:view"])

    expect(screen.getByRole("tab", { name: "システム" })).toBeTruthy()
  })

  test("orders the spaces as system, company, and apps", () => {
    renderSidebar(["batch:view", "employee:read"])

    const spaceTabs = screen.getAllByRole("tab")

    expect(spaceTabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "システム",
      "会社",
      "業務",
    ])
    expect(spaceTabs.every((tab) => tab.querySelector("svg") !== null)).toBe(true)
    expect(spaceTabs.every((tab) => tab.textContent === "")).toBe(true)
  })

  test("shows all three tabs to an account holding every permission", () => {
    renderSidebar(allPermissions)

    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "システム",
      "会社",
      "業務",
    ])
  })

  test("keeps only the apps tab when the other spaces have no visible item", () => {
    // 会社の項目は権限なしでも見えるので、無効化して空にする。
    renderSidebar([], ["employees", "departments", "grades", "positions", "team-management"])

    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "業務",
    ])
  })

  test("shows the selector even with a single membership", () => {
    pathnameMock.mockReturnValue("/teams/D001/members")

    renderSidebar([])

    const selector = screen.getByRole("combobox", { name: "自分の部署" })
    expect((selector as HTMLSelectElement).value).toBe("D001")
    expect(screen.getByRole("link", { name: "メンバー" }).getAttribute("href")).toBe(
      "/teams/D001/members",
    )
    expect(screen.queryByRole("link", { name: "概要" })).toBeNull()
    expect(screen.queryByRole("link", { name: "部署の目標" })).toBeNull()
    expect(screen.queryByRole("link", { name: "組織図" })).toBeNull()
  })

  test("keeps my team in the company space and the members link in the apps space", () => {
    pathnameMock.mockReturnValue("/teams/D001/members")

    renderSidebar(["goal:read:reports"])

    expect(screen.getByRole("link", { name: "メンバー" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "マイチーム" })).toBeNull()
  })

  test("shows only the department name when browsing a department outside my memberships", () => {
    pathnameMock.mockReturnValue("/teams/D003")

    renderSidebar([])

    expect(screen.queryByRole("combobox", { name: "自分の部署" })).toBeNull()
    expect(screen.getByText("Engineering")).toBeTruthy()
    expect(screen.getByRole("link", { name: "メンバー" }).getAttribute("href")).toBe(
      "/teams/D003/members",
    )
  })

  test("shows the org chart in the company space", () => {
    pathnameMock.mockReturnValue("/company/departments")

    renderSidebar([])

    expect(screen.getByRole("link", { name: "組織図" }).getAttribute("href")).toBe(
      "/company/departments",
    )
  })

  test("shows department domain links with the department permission", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar(["goal:read:department"])

    expect(screen.getByRole("link", { name: "部署の目標" }).getAttribute("href")).toBe(
      "/teams/D001/goals",
    )
    expect(screen.queryByRole("link", { name: "部署の勤怠" })).toBeNull()
  })

  test("keeps the inbox and the notifications in the apps space", () => {
    renderSidebar([])

    expect(screen.getByRole("link", { name: "受信箱" }).getAttribute("href")).toBe("/inbox")
    expect(screen.getByRole("link", { name: "通知" }).getAttribute("href")).toBe("/notifications")
  })

  test("selects the space tab from the current pathname", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar(allPermissions)

    expect(screen.getByRole("tab", { name: "業務" }).getAttribute("aria-selected")).toBe("true")

    cleanup()
    pathnameMock.mockReturnValue("/company/employees")
    renderSidebar(allPermissions)

    expect(screen.getByRole("tab", { name: "会社" }).getAttribute("aria-selected")).toBe("true")

    cleanup()
    pathnameMock.mockReturnValue("/system/batches")
    renderSidebar(allPermissions)

    expect(screen.getByRole("tab", { name: "システム" }).getAttribute("aria-selected")).toBe("true")
  })

  test("shows apps items on the default space without leaking other spaces", () => {
    renderSidebar([])

    expect(screen.getByRole("link", { name: "ホーム" }).getAttribute("href")).toBe("/")
    expect(screen.queryByRole("link", { name: "従業員" })).toBeNull()
  })
})

describe("SidebarNav feature registry", () => {
  test("keeps development metadata without rendering a legend", () => {
    pathnameMock.mockReturnValue("/my/attendances")

    renderSidebar([])

    const link = screen.getByRole("link", { name: "勤怠" })
    expect(link.querySelector("svg")?.classList.contains("text-feature-development")).toBe(true)
    expect(screen.queryByText("開発中")).toBeNull()
    expect(screen.queryByText("琥珀色のアイコン")).toBeNull()
    expect(link.getAttribute("aria-description")).toBe("app-default・開発中")
  })

  test("does not add development treatment to available features", () => {
    pathnameMock.mockReturnValue("/")

    renderSidebar([])

    const link = screen.getByRole("link", { name: "ホーム" })
    expect(link.querySelector("svg")?.classList.contains("text-feature-development")).toBe(false)
    expect(within(link).queryByText("開発中")).toBeNull()
  })

  test("groups my features by their task-oriented registry group", () => {
    pathnameMock.mockReturnValue("/")

    renderSidebar([])

    expect(screen.getByText("概要")).toBeTruthy()
    expect(screen.getByText("時間と予定")).toBeTruthy()
    expect(screen.getByText("申請と手続き")).toBeTruthy()
    expect(screen.getByText("成長と評価")).toBeTruthy()
    expect(screen.getByText("資産と施設")).toBeTruthy()
  })

  test("hides retirement candidates even when the permission is held", () => {
    pathnameMock.mockReturnValue("/company/employees")

    renderSidebar(["management_dashboard:view"])

    expect(screen.queryByRole("link", { name: "経営ダッシュボード" })).toBeNull()
  })
})

function renderSidebar(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string> = [],
) {
  return render(
    <SidebarProvider>
      <SidebarNav
        inboxCounts={inboxCounts}
        unreadNotificationCount={0}
        permissions={permissions}
        disabledFeatures={disabledFeatures}
        myDepartments={[{ code: "D001", name: "Corporate Planning", assignment_type: "primary" }]}
        allDepartments={[
          { code: "D001", name: "Corporate Planning", depth: 0 },
          { code: "D003", name: "Engineering", depth: 1 },
        ]}
      />
    </SidebarProvider>,
  )
}
