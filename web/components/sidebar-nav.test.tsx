import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarProvider } from "@/components/ui/sidebar"
import { featureRegistry } from "@/lib/feature/feature-registry"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

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
    pathnameMock.mockReturnValue("/audit-events")

    renderSidebar(["audit:read"])

    const link = screen.getByRole("link", { name: "監査ログ" })
    expect(link.getAttribute("href")).toBe("/audit-events")
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

    expect(screen.getByRole("link", { name: "バッチ実行履歴" }).getAttribute("data-prefetch")).toBe(
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
    pathnameMock.mockReturnValue("/company/employee-directory")

    renderSidebar([])

    expect(screen.queryByRole("link", { name: "規程・手続き" })).toBeNull()
  })
})

describe("SidebarNav workflow-repairs entry (requiredAllPermissions)", () => {
  test("shows only when both required permissions are held", () => {
    pathnameMock.mockReturnValue("/workflow-repairs")

    renderSidebar(["application:read:all", "application_template:manage"])

    expect(screen.getByRole("link", { name: "承認経路の修復" }).getAttribute("href")).toBe(
      "/workflow-repairs",
    )
  })

  test("hides when only one required permission is held", () => {
    pathnameMock.mockReturnValue("/company/employee-directory")

    renderSidebar(["application:read:all"])

    expect(screen.queryByRole("link", { name: "承認経路の修復" })).toBeNull()
  })
})

describe("所有区分で分けた管理タブ", () => {
  test("タブは固定ヘッダー、メニューだけをスクロール領域に置く", () => {
    renderSidebar(allPermissions)
    const tabs = screen.getByRole("tablist", { name: "管理メニュー" })
    expect(tabs.closest('[data-slot="sidebar-header"]')).not.toBeNull()
    expect(tabs.closest('[data-slot="sidebar-content"]')).toBeNull()
    fireEvent.click(screen.getByRole("tab", { name: "横断" }))
    expect(screen.queryByText("横断管理")).toBeNull()
    expect(
      screen.getByRole("link", { name: "申請一覧" }).closest('[data-slot="sidebar-content"]'),
    ).not.toBeNull()
  })
  test("リソースの詳細ではホームを同時に選択しない", () => {
    pathnameMock.mockReturnValue("/system/accounts/example")
    renderSidebar(allPermissions)
    expect(screen.getByRole("link", { name: "アカウント" }).hasAttribute("data-active")).toBe(true)
    expect(screen.getByRole("link", { name: "ホーム" }).hasAttribute("data-active")).toBe(false)
  })
  test("4タブを切り替えても別所有者の項目とホームを混ぜない", () => {
    renderSidebar(allPermissions)
    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "システム",
      "会社",
      "横断",
      "業務",
    ])
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.textContent).toBe("")
      expect(tab.querySelector("svg")).not.toBeNull()
    }
    expect(screen.queryByText("APIのみ（データ画面なし）")).toBeNull()
    for (const [label, present, absent] of [
      ["システム", "バッチ実行履歴", "従業員一覧"],
      ["会社", "従業員一覧", "勤怠記録"],
      ["横断", "承認・確認待ち", "アカウント"],
      ["業務", "勤怠記録", "バッチ実行履歴"],
    ]) {
      fireEvent.click(screen.getByRole("tab", { name: label }))
      expect(screen.getByRole("link", { name: present })).toBeTruthy()
      expect(screen.queryByRole("link", { name: absent })).toBeNull()
      expect(screen.queryByText("概要")).toBeNull()
      expect(screen.queryAllByRole("link", { name: "ホーム" })).toHaveLength(
        label === "業務" ? 0 : 1,
      )
    }
  })

  test("無効機能を隠し、本人と全社の閲覧権限を分ける", () => {
    pathnameMock.mockReturnValue("/expense/expenses")
    renderSidebar(["expense:read:all"], ["attendance"])
    expect(screen.getByRole("link", { name: "経費申請" }).getAttribute("href")).toBe(
      "/expense/expenses",
    )
    expect(screen.queryByRole("link", { name: "全社の経費" })).toBeNull()
    expect(screen.queryByRole("link", { name: "勤怠記録" })).toBeNull()
  })

  test("旧System URLの申請でも横断タブを選ぶ", () => {
    pathnameMock.mockReturnValue("/applications")
    renderSidebar(allPermissions)
    expect(screen.getByRole("tab", { name: "横断" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("link", { name: "申請一覧" })).toBeTruthy()
  })
})

function renderSidebar(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string> = [],
) {
  return render(
    <SidebarProvider>
      <SidebarNav permissions={permissions} disabledFeatures={disabledFeatures} />
    </SidebarProvider>,
  )
}
