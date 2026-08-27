import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/repositories/expense.repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ExpenseCategory } from "@/lib/schemas"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { ValidationError } from "@/lib/errors"

export type Command = {
  employeeId: EmployeeId
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  createdAt: string
}

/**
 * 本人の経費申請を作成する。
 */
export class SubmitExpense {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Expense | ApplicationError> {
    const repository = new ExpenseRepository(this.c)

    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      this.c,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) {
      return new UnexpectedError("failed to resolve expense organization", { cause: snapshot })
    }
    const employee = snapshot.employees.find((state) => state.employeeId === command.employeeId)
    if (employee?.primaryAssignment === null || employee?.primaryAssignment === undefined) {
      return new ValidationError(
        "employee has no current primary organization assignment",
        "organization_assignment_required",
      )
    }

    const expense = Expense.create({
      employeeId: command.employeeId,
      organizationUnitId: employee.primaryAssignment.organizationUnitId,
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(expense)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create expense", { cause: created })
    }

    return created
  }
}
