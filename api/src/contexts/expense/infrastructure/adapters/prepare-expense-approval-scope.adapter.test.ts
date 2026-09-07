import { expect, spyOn, test } from "bun:test"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { PrepareExpenseApprovalScopeAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-approval-scope.adapter"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { ConflictError } from "@/lib/errors"

async function fixture() {
  const c = await createExpenseProcedureTestContext()
  async function transfer() {
    const response = await c.write(
      [
        {
          organizationId: "organization:default",
          type: "organization-unit",
          id: "unit-period:transferred",
          revision: 1,
          state: "active",
          effectiveFrom: c.command.spentAt,
          effectiveTo: null,
          attributes: {
            organizationUnitId: "unit:transferred",
            code: "TRANSFERRED",
            officialName: "Transferred Team",
            kind: "TEAM",
            parentOrganizationUnitId: c.root.id,
          },
        },
        {
          ...c.assignment,
          revision: 2,
          effectiveFrom: c.command.spentAt,
          attributes: { ...c.assignment.attributes, organizationUnitId: "unit:transferred" },
        },
      ],
      await c.companyRevision(),
      crypto.randomUUID(),
    )
    expect(Number(response.status)).toBe(201)
  }
  return { c, transfer }
}

test("申請者の所属を変更しても提出済み経費の負担組織を解決する", async () => {
  const { c, transfer } = await fixture()
  const expense = await c.create()
  const adapter = new PrepareExpenseApprovalScopeAdapter(c.context)
  const original = await adapter.prepare({
    organizationUnitId: expense.submitted.request.organizationUnitId,
    at: c.at,
  })
  if (original instanceof Error) throw original
  await transfer()
  expect(await c.read(c.command.spentAt)).toMatchObject({
    primaryAssignment: { organizationUnitId: "unit:transferred" },
  })
  const current = await adapter.prepare({
    organizationUnitId: expense.submitted.request.organizationUnitId,
    at: c.at,
  })
  if (current instanceof Error) throw current
  expect(current.targetDepartmentCode).toBe(original.targetDepartmentCode)
  expect(current.targetDepartmentCode).not.toBe("TRANSFERRED")
  expect(await c.database.batch([original.guard]).catch((cause: unknown) => cause)).toBeInstanceOf(
    Error,
  )
  expect(await c.database.batch([current.guard])).toHaveLength(1)
  expect(await expense.decide()).toMatchObject({ status: "pending" })
})

test("資格確認後の会社変更で経費判断を取り消し、再確認後に同じ対象で判断できる", async () => {
  const { c, transfer } = await fixture()
  const expense = await c.create()
  const save = c.repository.recordDecision.bind(c.repository)
  const interception = spyOn(
    ExpenseProcedureRepository.prototype,
    "recordDecision",
  ).mockImplementation(async (input) => {
    await transfer()
    return save(input)
  })
  try {
    expect(await expense.decide()).toBeInstanceOf(ConflictError)
  } finally {
    interception.mockRestore()
  }
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations WHERE case_id = ?1")
      .bind(expense.binding.caseId)
      .first<number>("total"),
  ).toBe(0)
  expect(await expense.decide()).toMatchObject({ status: "pending" })
})
