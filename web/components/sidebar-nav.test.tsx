import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarProvider } from "@/components/ui/sidebar"

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
    pathnameMock.mockReturnValue("/organization/governance")

    renderSidebar(["governance:read"])

    expect(screen.getByRole("link", { name: "規程・手続き" }).getAttribute("href")).toBe(
      "/organization/governance",
    )
  })

  test("hides the governance link without governance:read", () => {
    pathnameMock.mockReturnValue("/organization/employees")

    renderSidebar([])

    expect(screen.queryByRole("link", { name: "規程・手続き" })).toBeNull()
  })
})

describe("SidebarNav team entry (requiredAnyPermission)", () => {
  test("shows マイチーム in the teams space with any one of the scope permissions", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar(["leave:read:reports"])

    expect(screen.getByRole("link", { name: "マイチーム" }).getAttribute("href")).toBe(
      "/teams/reports",
    )
  })

  test("shows マイチーム with a different single scope permission", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar(["goal:read:reports"])

    expect(screen.getByRole("link", { name: "マイチーム" })).toBeTruthy()
  })

  test("hides マイチーム when none of the scope permissions are held", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar(["employee:create"])

    expect(screen.queryByRole("link", { name: "マイチーム" })).toBeNull()
  })
})

describe("SidebarNav workflow-repairs entry (requiredAllPermissions)", () => {
  test("shows only when both required permissions are held", () => {
    pathnameMock.mockReturnValue("/organization/workflow-repairs")

    renderSidebar(["application:read:all", "application_template:manage"])

    expect(screen.getByRole("link", { name: "ワークフロー修復" }).getAttribute("href")).toBe(
      "/organization/workflow-repairs",
    )
  })

  test("hides when only one required permission is held", () => {
    pathnameMock.mockReturnValue("/organization/employees")

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

  test("orders the spaces as system, company, and other work", () => {
    renderSidebar(["batch:view"])

    const spaceTabs = screen.getAllByRole("tab")

    expect(spaceTabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "システム",
      "会社",
      "その他の業務（おまけ）",
    ])
    expect(spaceTabs.every((tab) => tab.querySelector("svg") !== null)).toBe(true)
    expect(spaceTabs.every((tab) => tab.textContent === "")).toBe(true)
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

  test("places my team above the department members", () => {
    pathnameMock.mockReturnValue("/teams/D001/members")

    renderSidebar(["goal:read:reports"])

    const links = screen.getAllByRole("link")
    const myTeamIndex = links.findIndex((link) => link.textContent?.includes("マイチーム"))
    const membersIndex = links.findIndex((link) => link.textContent?.includes("メンバー"))
    expect(myTeamIndex).toBeGreaterThanOrEqual(0)
    expect(myTeamIndex).toBeLessThan(membersIndex)
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

  test("shows the org chart in the organization space", () => {
    pathnameMock.mockReturnValue("/organization/departments")

    renderSidebar([])

    expect(screen.getByRole("link", { name: "組織図" }).getAttribute("href")).toBe(
      "/organization/departments",
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

  test("keeps inbox and notifications in the other work space", () => {
    renderSidebar([])

    expect(screen.getByRole("link", { name: "受信箱" }).getAttribute("href")).toBe("/company/inbox")
    expect(screen.getByRole("link", { name: "通知" }).getAttribute("href")).toBe(
      "/company/notifications",
    )
    expect(screen.queryByRole("link", { name: "ホーム" })).toBeNull()
  })

  test("selects the space tab from the current pathname", () => {
    pathnameMock.mockReturnValue("/teams/D001")

    renderSidebar([])

    expect(
      screen.getByRole("tab", { name: "その他の業務（おまけ）" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  test("shows my items on the default space without leaking other spaces", () => {
    renderSidebar([])

    expect(screen.getByRole("link", { name: "マイページ" }).getAttribute("href")).toBe("/my")
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
    pathnameMock.mockReturnValue("/my")

    renderSidebar([])

    const link = screen.getByRole("link", { name: "マイページ" })
    expect(link.querySelector("svg")?.classList.contains("text-feature-development")).toBe(false)
    expect(within(link).queryByText("開発中")).toBeNull()
  })

  test("groups my features by their task-oriented registry group", () => {
    pathnameMock.mockReturnValue("/my")

    renderSidebar([])

    expect(screen.getByText("概要")).toBeTruthy()
    expect(screen.getByText("時間と予定")).toBeTruthy()
    expect(screen.getByText("申請と手続き")).toBeTruthy()
    expect(screen.getByText("成長と評価")).toBeTruthy()
    expect(screen.getByText("資産と施設")).toBeTruthy()
  })

  test("hides retirement candidates even when the permission is held", () => {
    pathnameMock.mockReturnValue("/organization/employees")

    renderSidebar(["management_dashboard:view"])

    expect(screen.queryByRole("link", { name: "経営ダッシュボード" })).toBeNull()
  })
})

function renderSidebar(permissions: ReadonlyArray<string>) {
  return render(
    <SidebarProvider>
      <SidebarNav
        inboxCounts={inboxCounts}
        unreadNotificationCount={0}
        permissions={permissions}
        disabledFeatures={[]}
        myDepartments={[{ code: "D001", name: "Corporate Planning", assignment_type: "primary" }]}
        allDepartments={[
          { code: "D001", name: "Corporate Planning", depth: 0 },
          { code: "D003", name: "Engineering", depth: 1 },
        ]}
      />
    </SidebarProvider>,
  )
}
