import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { TeamMemberAddForm } from "@/app/(app)/teams/[team]/_components/team-member-add-form"
import { getAssignmentBaseRevisionsAction } from "@/app/(app)/teams/[team]/actions"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/app/(app)/teams/[team]/actions", () => ({
  getAssignmentBaseRevisionsAction: vi.fn(),
  searchTeamMemberCandidatesAction: vi.fn(),
}))
vi.mock("@/app/(app)/company/employees/[employee]/actions", () => ({
  submitPersonnelAction: vi.fn(),
}))
vi.mock("@/app/(app)/company/employees/load-personnel-position-snapshot", () => ({
  loadPersonnelPositionSnapshot: vi.fn(),
}))
vi.mock("@/components/ui/employee-combobox", () => ({
  EmployeeCombobox: (props: { onValueChange: (employee: EmployeeListItem | null) => void }) => (
    <div>
      {["FIRST", "SECOND"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() =>
            props.onValueChange({
              code,
              name: code,
              deptName: null,
              position: null,
              email: "you@example.com",
              status: "active",
            })
          }
        >
          {code}
        </button>
      ))}
      <button type="button" onClick={() => props.onValueChange(null)}>
        Clear employee
      </button>
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

test("keeps revisions attached to the selected employee when responses arrive out of order", async () => {
  const first =
    Promise.withResolvers<Awaited<ReturnType<typeof getAssignmentBaseRevisionsAction>>>()
  const second =
    Promise.withResolvers<Awaited<ReturnType<typeof getAssignmentBaseRevisionsAction>>>()
  vi.mocked(getAssignmentBaseRevisionsAction)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  render(<TeamMemberAddForm teamCode="TEAM" companyRevision={8} />)
  fireEvent.click(screen.getByRole("button", { name: "メンバーを追加" }))
  fireEvent.click(await screen.findByRole("button", { name: "FIRST" }))
  fireEvent.click(screen.getByRole("button", { name: "SECOND" }))
  await act(async () => {
    second.resolve({ employeeRevision: 22, organizationRevision: 4 })
    await second.promise
  })
  await act(async () => {
    first.resolve({ employeeRevision: 11, organizationRevision: 3 })
    await first.promise
  })
  const form = screen.getByRole("dialog").querySelector("form")
  if (form === null) throw new Error("form missing")
  expect(new FormData(form).get("employee_code")).toBe("SECOND")
  expect(new FormData(form).get("employee_revision")).toBe("22")
  expect(new FormData(form).get("organization_revision")).toBe("4")
})
