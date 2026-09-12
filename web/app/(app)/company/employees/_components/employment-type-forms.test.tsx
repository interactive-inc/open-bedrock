import { loadPersonnelPositionSnapshot } from "@/app/(app)/company/employees/load-personnel-position-snapshot"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EmployeeCreateForm } from "@/app/(app)/company/employees/_components/employee-create-form"
import { PersonnelActionForm } from "@/app/(app)/company/employees/[employee]/_components/personnel-action-form"
vi.mock("@/app/(app)/company/employees/load-personnel-position-snapshot", () => ({
  loadPersonnelPositionSnapshot: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(app)/company/employees/actions", () => ({ createEmployeeAction: vi.fn() }))
vi.mock("@/app/(app)/company/employees/[employee]/actions", () => ({
  submitPersonnelAction: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
function selectType() {
  const select = screen.getByRole("combobox", { name: "雇用区分" })
  if (!(select instanceof HTMLSelectElement)) throw new Error("employment selector is missing")
  expect(select.required).toBe(true)
  expect(select.value).toBe("")
  fireEvent.change(select, { target: { value: "PART_TIME" } })
  const form = select.closest("form")
  if (form === null) throw new Error("form is missing")
  expect(new FormData(form).get("employment_type")).toBe("PART_TIME")
}
describe("雇用区分の明示選択", () => {
  test("新規登録で既定値を選ばず、利用者の選択を送る", () => {
    render(<EmployeeCreateForm canAssignRole={false} companyRevision={8} />)
    selectType()
  })
  test("再入社を選ぶと雇用区分の入力を要求する", async () => {
    render(
      <PersonnelActionForm
        employeeCode="E100"
        employeeRevision={1}
        organizationRevision={1}
        companyRevision={8}
        canApply
        canRequest
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "人事変更" }))
    fireEvent.change(await screen.findByRole("combobox", { name: "変更種別" }), {
      target: { value: "rehire" },
    })
    selectType()
  })
})

test("入社日の変更で旧役職の選択を破棄し、同じ会社版の読取完了まで登録を止める", async () => {
  vi.mocked(loadPersonnelPositionSnapshot).mockResolvedValueOnce({
    ok: true,
    companyRevision: 8,
    effectiveOn: "2026-01-01",
    positions: [{ id: "position:coordinator", code: "COORDINATOR", name: "Coordinator" }],
  })
  const page = render(<EmployeeCreateForm canAssignRole={false} companyRevision={8} />)
  const date = screen.getByLabelText("入社日")
  const submit = page.container.querySelector('button[type="submit"]')
  if (!(submit instanceof HTMLButtonElement)) throw new Error("submit missing")
  expect(submit.disabled).toBe(true)
  fireEvent.change(date, { target: { value: "2026-01-01" } })
  await screen.findByRole("option", { name: "Coordinator" })
  await waitFor(() => expect(submit.disabled).toBe(false))
  const selector = page.container.querySelector('select[name="position_code"]')
  if (!(selector instanceof HTMLSelectElement)) throw new Error("position selector missing")
  fireEvent.change(selector, { target: { value: "COORDINATOR" } })
  const next = Promise.withResolvers<Awaited<ReturnType<typeof loadPersonnelPositionSnapshot>>>()
  vi.mocked(loadPersonnelPositionSnapshot).mockReturnValueOnce(next.promise)
  fireEvent.change(date, { target: { value: "2026-07-01" } })
  expect(submit.disabled).toBe(true)
  expect(screen.queryByRole("option", { name: "Coordinator" })).toBeNull()
  next.resolve({ ok: true, companyRevision: 8, effectiveOn: "2026-07-01", positions: [] })
  await waitFor(() => expect(submit.disabled).toBe(false))
  const form = submit.closest("form")
  if (form === null) throw new Error("form missing")
  expect(new FormData(form).get("position_code")).toBe("")
  expect(new FormData(form).get("company_revision")).toBe("8")
  expect(loadPersonnelPositionSnapshot).toHaveBeenLastCalledWith(8, "2026-07-01")
})
