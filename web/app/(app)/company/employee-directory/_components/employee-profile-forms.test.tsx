import { EmployeeEditForm } from "@/app/(app)/company/employee-directory/_components/employee-edit-form"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
vi.mock("@/app/(app)/company/employee-directory/actions", () => ({ updateEmployeeAction: vi.fn() }))
vi.mock("@/app/(app)/settings/actions", () => ({ updatePhoneAction: vi.fn() }))
afterEach(cleanup)
const profile = {
  employeeId: "employee:profile",
  organizationRevision: 7,
  personRevision: 3,
  effectiveOn: "2026-06-02",
}
const commandId = "12345678-1234-4abc-8def-1234567890ab"
function fields(input: HTMLElement) {
  const form = input.closest("form")
  if (form === null) throw new Error("missing form")
  const body = new FormData(form)
  expect(body.get("profile_employee_id")).toBe(profile.employeeId)
  expect(body.get("profile_organization_revision")).toBe("7")
  expect(body.get("profile_person_revision")).toBe("3")
  expect(body.get("profile_effective_on")).toBe(profile.effectiveOn)
  expect(body.get("profile_command_id")).toBe(commandId)
  return body
}
describe("人物編集フォームの版と再送キー", () => {
  test("氏名フォームは表示した人物版を保持して入力値と一緒に送る", async () => {
    render(
      <EmployeeEditForm
        code="PROFILE-001"
        name="Example Person"
        profile={profile}
        commandId={commandId}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "編集" }))
    const input = await screen.findByRole("textbox", { name: "氏名" })
    fireEvent.change(input, { target: { value: "Changed Person" } })
    expect(fields(input).get("name")).toBe("Changed Person")
  })
  test("公開人物との対応がない場合は保存入口を表示しない", () => {
    render(
      <>
        <EmployeeEditForm
          code="PROFILE-001"
          name="Example Person"
          profile={null}
          commandId={commandId}
        />
      </>,
    )
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getAllByText(/人物情報の対応確認/)).toHaveLength(1)
  })
})
