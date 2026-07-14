import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarProvider } from "@/components/ui/sidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/audit-events" }))
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

afterEach(cleanup)

describe("SidebarNav audit entry", () => {
  test("shows a no-prefetch audit link only with live audit:read permission", () => {
    renderSidebar(["audit:read"])

    const link = screen.getByRole("link", { name: "監査ログ" })
    expect(link.getAttribute("href")).toBe("/admin/audit-events")
    expect(link.getAttribute("data-prefetch")).toBe("false")
  })

  test("hides the audit entry without read permission", () => {
    renderSidebar(["audit:export"])

    expect(screen.queryByRole("link", { name: "監査ログ" })).toBeNull()
  })

  test("does not change the existing prefetch behavior of unrelated links", () => {
    renderSidebar(["batch:view"])

    expect(screen.getByRole("link", { name: "バッチ" }).getAttribute("data-prefetch")).toBe(
      "undefined",
    )
  })
})

function renderSidebar(permissions: ReadonlyArray<string>): void {
  render(
    <SidebarProvider>
      <SidebarNav inboxCounts={inboxCounts} unreadNotificationCount={0} permissions={permissions} />
    </SidebarProvider>,
  )
}
