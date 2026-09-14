import { CommandPalette } from "@/components/command-palette"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("CommandPalette audit entry", () => {
  test("shows the audit command only with audit:read and navigates once on explicit selection", () => {
    render(<CommandPalette disabledFeatures={[]} permissions={["audit:read"]} />)
    openPalette()

    const command = screen.getByText("監査ログ")
    expect(command).toBeTruthy()
    fireEvent.click(command)
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/system/audit-events")
  })

  test("does not expose the audit command to export-only users", () => {
    render(<CommandPalette disabledFeatures={[]} permissions={["audit:export"]} />)
    openPalette()

    expect(screen.queryByText("監査ログ")).toBeNull()
  })
})

describe("CommandPalette governance entries", () => {
  test("filters reader and manager commands by effective permissions", () => {
    const view = render(<CommandPalette disabledFeatures={[]} permissions={["governance:read"]} />)
    openPalette()
    expect(screen.getByText("規程・手続き")).toBeTruthy()
    expect(screen.queryByText("規程の整合性と組織ロール")).toBeNull()
    view.unmount()

    render(<CommandPalette disabledFeatures={[]} permissions={["governance:manage"]} />)
    openPalette()
    expect(screen.queryByText("規程・手続き")).toBeNull()
    expect(screen.queryByText("自分の申請")).toBeNull()
  })
})

function openPalette(): void {
  fireEvent.keyDown(document, { key: "k", ctrlKey: true })
}
