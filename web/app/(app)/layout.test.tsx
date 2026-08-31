import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AuthError } from "@/lib/api/auth-error"

const mocks = vi.hoisted(() => ({ getMe: vi.fn() }))

vi.mock("@/lib/api/get-me", () => ({ getMe: mocks.getMe }))
vi.mock("@/app/(app)/actions/logout", () => ({ logoutAction: vi.fn() }))
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
}))
vi.mock("@/components/auth-provider", () => ({
  AuthProvider: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
}))
vi.mock("@/lib/api/get-feature-availability", () => ({ getFeatureAvailability: vi.fn() }))
vi.mock("@/lib/api/get-inbox-counts", () => ({ getInboxCounts: vi.fn() }))
vi.mock("@/lib/api/get-my-departments", () => ({ getMyDepartments: vi.fn() }))
vi.mock("@/lib/api/get-my-unread-count", () => ({ getMyUnreadCount: vi.fn() }))
vi.mock("@/lib/api/get-org-tree", () => ({ getOrgTree: vi.fn() }))
vi.mock("@/lib/i18n/get-locale", () => ({ getLocale: vi.fn() }))
vi.mock("@/lib/org/flatten-org-tree", () => ({ flattenOrgTree: vi.fn() }))
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }))

vi.mock("@/components/login-page", () => ({
  LoginPage: () => <div>LoginPage</div>,
}))

import AppLayout from "@/app/(app)/layout"

afterEach(() => vi.clearAllMocks())

describe("AppLayout", () => {
  test("未認証ならログイン画面を正常描画する", async () => {
    mocks.getMe.mockRejectedValueOnce(new AuthError())

    render(await AppLayout({ children: <div>protected</div> }))

    expect(screen.getByText("LoginPage")).toBeDefined()
    expect(screen.queryByText("protected")).toBeNull()
  })

  test("予期しない本人取得失敗は上位のerror boundaryへ伝播する", async () => {
    const error = new Error("unexpected")
    mocks.getMe.mockRejectedValueOnce(error)

    await expect(AppLayout({ children: <div>protected</div> })).rejects.toBe(error)
  })
})
