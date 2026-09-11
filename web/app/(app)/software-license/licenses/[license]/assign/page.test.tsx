import { afterEach, expect, test, vi } from "vite-plus/test"
import { cleanup, render, screen } from "@testing-library/react"
import LicenseAssignmentPage from "@/app/(app)/software-license/licenses/[license]/assign/page"
import { SidebarProvider } from "@/components/ui/sidebar"

const mocks = vi.hoisted(() => ({ me: vi.fn(), license: vi.fn(), directory: vi.fn() }))
vi.mock("@/lib/api/get-me", () => ({ getMe: mocks.me }))
vi.mock("@/lib/api/get-license", () => ({ getLicense: mocks.license }))
vi.mock("@/lib/api/get-employee-choices", () => ({ getEmployeeChoices: mocks.directory }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found")
  },
}))
vi.mock("@/app/(app)/software-license/licenses/[license]/_components/assignment-form", () => ({
  AssignmentForm: () => <div>利用開始フォーム</div>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test("記録権限がなければ契約と職員を取得しない", async () => {
  mocks.me.mockResolvedValue({ permissions: ["license:read:all"] })
  await expect(
    LicenseAssignmentPage({
      params: Promise.resolve({ license: "12" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("not found")
  expect(mocks.license).not.toHaveBeenCalled()
  expect(mocks.directory).not.toHaveBeenCalled()
})

test("検索語と位置を保って職員の続きを取得できる", async () => {
  mocks.me.mockResolvedValue({ permissions: ["license:manage"] })
  mocks.license.mockResolvedValue({ name: "Example service", plan_name: "Team", status: "active" })
  mocks.directory.mockResolvedValue({ employees: [], total: 120 })
  const page = await LicenseAssignmentPage({
    params: Promise.resolve({ license: "12" }),
    searchParams: Promise.resolve({ q: "A & B", offset: "50" }),
  })
  render(<SidebarProvider>{page}</SidebarProvider>)
  expect(mocks.directory).toHaveBeenCalledExactlyOnceWith("A & B", 50)
  expect(screen.getByRole("link", { name: "次の50件" }).getAttribute("href")).toBe(
    "/software-license/licenses/12/assign?q=A%20%26%20B&offset=100",
  )
  expect(screen.getByRole("link", { name: "前の50件" }).getAttribute("href")).toBe(
    "/software-license/licenses/12/assign?q=A%20%26%20B&offset=0",
  )
})

test("解約済み契約には入力フォームを表示しない", async () => {
  mocks.me.mockResolvedValue({ permissions: ["license:manage"] })
  mocks.license.mockResolvedValue({
    name: "Example service",
    plan_name: "Team",
    status: "cancelled",
  })
  mocks.directory.mockResolvedValue({ employees: [], total: 0 })
  const page = await LicenseAssignmentPage({
    params: Promise.resolve({ license: "12" }),
    searchParams: Promise.resolve({}),
  })
  render(<SidebarProvider>{page}</SidebarProvider>)
  expect(screen.queryByText("利用開始フォーム")).toBeNull()
  expect(screen.getByText("解約済みのサービスには利用者を追加できません。")).toBeTruthy()
})
