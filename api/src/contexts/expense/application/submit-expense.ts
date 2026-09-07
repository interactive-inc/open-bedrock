import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import type { CompanyContext as Context } from "@/contexts/company/configuration/company-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { NotFoundError, ForbiddenError } from "@/lib/errors"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/repositories/expense.repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ExpenseCategory } from "@/contexts/expense/domain/definitions/expense.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { ValidationError } from "@/lib/errors"

export type Command = {
  accountId: AccountId
  tokenVersion: number
  attachmentIds: ReadonlyArray<string>
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

    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:submit"],
      now: new Date(command.createdAt),
    })
    if (human === "forbidden")
      return new ForbiddenError("経費を提出する主体を確認できません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("提出資格を確認できません", { cause: human })
    const companyGuard = await repository.prepareSubmissionGuard(command.accountId)
    if (companyGuard instanceof Error)
      return new UnexpectedError("会社の状態を固定できません", { cause: companyGuard })
    const evidence = await new PrepareAttachmentEvidenceAdapter(this.c).prepare({
      attachmentIds: command.attachmentIds,
      ownerAccountId: command.accountId,
      linkedAttachmentIds: new Set(),
      at: new Date(command.createdAt),
    })
    if (evidence instanceof Error) {
      if (evidence.kind === "not_found") return new NotFoundError(evidence.message, evidence.code)
      if (evidence.code === "attachment_not_owned")
        return new ForbiddenError(evidence.message, evidence.code)
      if (evidence.kind === "unexpected")
        return new UnexpectedError(evidence.message, { cause: evidence })
      return new ValidationError(evidence.message, evidence.code)
    }

    const people = await new CompanyEmployeeDirectoryReadAdapter({
      env: { ...this.c.env, NOW: command.createdAt },
    }).findForAccountIds([command.accountId])
    if (people instanceof Error) {
      return new UnexpectedError("failed to resolve expense organization", { cause: people })
    }
    const employee = people.at(0)?.employee
    if (
      people.length !== 1 ||
      employee?.id !== command.employeeId ||
      employee.employment?.status !== "ACTIVE"
    )
      return new ForbiddenError("在籍中の本人だけが提出できます", "forbidden")
    const organizationUnitId = zOrganizationUnitId.safeParse(
      employee.primaryAssignment?.organizationUnitId,
    )
    if (!organizationUnitId.success) {
      return new ValidationError(
        "employee has no current primary organization assignment",
        "organization_assignment_required",
      )
    }

    const expense = Expense.create({
      employeeId: command.employeeId,
      organizationUnitId: organizationUnitId.data,
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.createWithAttachments({
      expense,
      attachmentIds: command.attachmentIds,
      guards: [...human.assertions, companyGuard, ...evidence.guards],
      effects: evidence.effects,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create expense", { cause: created })
    }

    return created
  }
}
