import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import InboxLayout from "@/app/(app)/inbox/layout"
import InboxPage from "@/app/(app)/inbox/page"

vi.mock("@/lib/api/get-me", () => ({ getMe: async () => ({ permissions: ["system:admin"] }) }))
vi.mock("@/lib/api/get-inbox-counts", () => ({ getInboxCounts: async () => ({ applications: 3 }) }))
vi.mock("@/lib/api/get-feature-availability", () => ({
  getFeatureAvailability: async () => new Error("機能設定を取得できませんでした"),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(cleanup)

test("設定不明の受信箱は種類タブと配下画面を表示しない", async () => {
  render(await InboxLayout({ children: <div>業務の承認画面</div> }))
  expect(screen.getByRole("alert").textContent).toContain("機能設定を取得できませんでした")
  expect(screen.queryByText("業務の承認画面")).toBeNull()
  expect(screen.queryAllByRole("link")).toHaveLength(0)
})

test("設定不明を対応待ちゼロや全機能有効として表示しない", async () => {
  render(await InboxPage())
  expect(screen.getByRole("alert").textContent).toContain("機能設定を取得できませんでした")
  expect(screen.queryByText("対応待ちはありません")).toBeNull()
  expect(screen.queryAllByRole("link")).toHaveLength(0)
})
