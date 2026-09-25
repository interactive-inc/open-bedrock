import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ExpenseApproval } from "@/contexts/expense/domain/entities/expense-approval.entity"
import { describe, expect, test } from "bun:test"

describe("ExpenseApproval.create", () => {
  test("builds an ExpenseApproval with null id", () => {
    const approval = ExpenseApproval.create({
      expenseId: "0190004e-0000-7000-8000-00000000000a",
      approverId: toWorkforceEmployeeId(3),
      action: "approve",
      comment: "Looks good",
      createdAt: "2026-06-05T10:00:00.000Z",
    })

    expect(approval).toBeInstanceOf(ExpenseApproval)
    expect(approval.id).toBeNull()
    expect(approval.expenseId).toBe("0190004e-0000-7000-8000-00000000000a")
    expect(approval.approverId).toBe(toWorkforceEmployeeId(3))
    expect(approval.comment).toBe("Looks good")
  })

  test("creates with approve action", () => {
    const approval = ExpenseApproval.create({
      expenseId: "0190004e-0000-7000-8000-00000000000b",
      approverId: toWorkforceEmployeeId(4),
      action: "approve",
      comment: null,
      createdAt: "2026-06-06T10:00:00.000Z",
    })

    expect(approval.action).toBe("approve")
    expect(approval.comment).toBeNull()
  })

  test("creates with reject action", () => {
    const approval = ExpenseApproval.create({
      expenseId: "0190004e-0000-7000-8000-00000000000c",
      approverId: toWorkforceEmployeeId(5),
      action: "reject",
      comment: "Missing receipt",
      createdAt: "2026-06-07T10:00:00.000Z",
    })

    expect(approval.action).toBe("reject")
    expect(approval.comment).toBe("Missing receipt")
  })
})
