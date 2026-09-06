import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { EmployeeCreateForm } from "@/app/(app)/company/employees/_components/employee-create-form"
import { PersonnelActionForm } from "@/app/(app)/company/employees/[employee]/_components/personnel-action-form"
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/app/(app)/company/employees/actions", () => ({ createEmployeeAction: vi.fn() }))
vi.mock("@/app/(app)/company/employees/[employee]/actions", () => ({
  submitPersonnelAction: vi.fn(),
}))
afterEach(cleanup)
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
    render(<EmployeeCreateForm canAssignRole={false} positions={[]} />)
    selectType()
  })
  test("再入社を選ぶと雇用区分の入力を要求する", async () => {
    render(
      <PersonnelActionForm
        employeeCode="E100"
        employeeRevision={1}
        organizationRevision={1}
        canApply
        canRequest
        positions={[]}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "人事変更" }))
    fireEvent.change(await screen.findByRole("combobox", { name: "変更種別" }), {
      target: { value: "rehire" },
    })
    selectType()
  })
})
