import { afterEach, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ReleaseAssignmentDialog } from "@/app/(app)/software-license/licenses/[license]/_components/release-assignment-dialog"

const mocks = vi.hoisted(() => ({ release: vi.fn(), refresh: vi.fn() }))
vi.mock("@/app/(app)/software-license/licenses/[license]/actions", () => ({
  releaseLicenseAssignmentAction: mocks.release,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test("解除の応答不明時に理由を保持し、同じ対象を再送して成功後に閉じる", async () => {
  const submitted: Array<{ id: FormDataEntryValue | null; reason: FormDataEntryValue | null }> = []
  mocks.release.mockImplementation(async (_previous: unknown, form: FormData) => {
    submitted.push({ id: form.get("id"), reason: form.get("reason") })
    if (submitted.length === 1) return { ok: false, error: "応答不明" }
    return { ok: true, error: null }
  })
  render(
    <ReleaseAssignmentDialog
      assignmentId="assignment-id"
      employeeName="Example Employee"
      serviceName="Example service"
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "利用解除を記録" }))
  await screen.findByRole("dialog")
  fireEvent.change(screen.getByLabelText("解除理由"), { target: { value: "利用終了" } })
  fireEvent.click(screen.getByRole("button", { name: "解除を記録する" }))
  await screen.findByText("応答不明")
  expect(screen.getByLabelText("解除理由")).toHaveProperty("value", "利用終了")
  expect(mocks.refresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "解除を記録する" }))
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
  expect(submitted).toEqual([
    { id: "assignment-id", reason: "利用終了" },
    { id: "assignment-id", reason: "利用終了" },
  ])
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})
