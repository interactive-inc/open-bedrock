import { SidebarProvider } from "@/components/ui/sidebar"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { cleanup, render, screen } from "@testing-library/react"
import LicenseUsagePage from "@/app/(app)/software-license/licenses/[license]/page"

vi.mock("@/lib/api/get-me", () => ({ getMe: async () => ({ permissions: ["license:read:all"] }) }))
vi.mock("@/lib/api/get-license", () => ({
  getLicense: async () => ({
    name: "Example service",
    plan_name: "Current team plan",
    status: "active",
  }),
}))
vi.mock("@/lib/api/get-license-assignments", () => ({
  getLicenseAssignments: async () => ({
    data: [
      {
        id: "assignment",
        employee_id: "employee-1",
        employee_name: "Example Employee",
        plan_name: "Original personal plan",
        account_reference: "external-reference",
        assigned_at: 1000,
        assigned_reason: "Initial access",
        released_at: 2000,
        release_reason: "No longer required",
      },
    ],
    has_more: true,
  }),
}))
afterEach(cleanup)

test("現在の契約プランと利用開始時の記録を区別し、解除理由を保持する", async () => {
  const page = await LicenseUsagePage({
    params: Promise.resolve({ license: "12" }),
    searchParams: Promise.resolve({ state: "released", offset: "20" }),
  })
  render(<SidebarProvider>{page}</SidebarProvider>)
  expect(screen.getByText(/現在のプラン: Current team plan/)).toBeTruthy()
  expect(screen.getByText("Original personal plan")).toBeTruthy()
  expect(screen.getByText("Example Employee")).toBeTruthy()
  expect(screen.getByText("No longer required")).toBeTruthy()
  expect(screen.getByRole("link", { name: "次の20件" }).getAttribute("href")).toBe(
    "/software-license/licenses/12?state=released&offset=40",
  )
  expect(screen.getByRole("link", { name: "前の20件" }).getAttribute("href")).toBe(
    "/software-license/licenses/12?state=released&offset=0",
  )
})
