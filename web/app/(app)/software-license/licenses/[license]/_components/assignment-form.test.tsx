import { afterEach, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AssignmentForm } from "@/app/(app)/software-license/licenses/[license]/_components/assignment-form"

const mocks = vi.hoisted(() => ({ assign: vi.fn(), push: vi.fn() }))
vi.mock("@/app/(app)/software-license/licenses/[license]/actions", () => ({
  assignLicenseAction: mocks.assign,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test("職員コードでなくIDを送り、失敗再送のIDを維持して入力変更時だけ更新する", async () => {
  const submitted: Array<{ id: FormDataEntryValue | null; employee: FormDataEntryValue | null }> =
    []
  mocks.assign.mockImplementation(async (_previous: unknown, form: FormData) => {
    submitted.push({ id: form.get("id"), employee: form.get("employee_id") })
    return { ok: false, error: "応答不明" }
  })
  render(
    <AssignmentForm
      licenseId={12}
      employees={[{ id: "employee-id", code: "E001", name: "Example Employee" }]}
    />,
  )
  fireEvent.change(screen.getByLabelText("職員"), { target: { value: "employee-id" } })
  fireEvent.change(screen.getByLabelText("利用開始を記録する理由"), {
    target: { value: "業務利用" },
  })
  fireEvent.click(screen.getByRole("button", { name: "利用開始を記録する" }))
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(1))
  await screen.findByText("応答不明")
  expect(screen.getByLabelText("職員")).toHaveProperty("value", "employee-id")
  expect(screen.getByLabelText("利用開始を記録する理由")).toHaveProperty("value", "業務利用")
  expect(screen.getByRole("button", { name: "利用開始を記録する" }).hasAttribute("disabled")).toBe(
    false,
  )
  fireEvent.click(screen.getByRole("button", { name: "利用開始を記録する" }))
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(2))
  expect(submitted[0]?.employee).toBe("employee-id")
  expect(submitted[0]?.id).toBeTruthy()
  expect(submitted[1]?.id).toBe(submitted[0]?.id)
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "利用開始を記録する" }).hasAttribute("disabled"),
    ).toBe(false),
  )
  fireEvent.change(screen.getByLabelText("利用開始を記録する理由"), {
    target: { value: "別の利用目的" },
  })
  fireEvent.click(screen.getByRole("button", { name: "利用開始を記録する" }))
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(3))
  expect(submitted[2]?.id).not.toBe(submitted[0]?.id)
  expect(mocks.push).not.toHaveBeenCalled()
})
