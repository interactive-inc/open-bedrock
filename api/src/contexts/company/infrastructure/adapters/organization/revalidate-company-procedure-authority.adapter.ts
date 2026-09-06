import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ResolveCompanyProcedureApproverMatchesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-approver-matches.adapter"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = CompanyContext

/** 固定済みTaskの条件を判断時点の会社上の資格へ再適用する。 */
export class RevalidateCompanyProcedureAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async revalidate(
    input: Readonly<{
      step: ApplicationWorkflowStep
      representedAccountId: AccountId
      subjectEmployeeId: EmployeeId | null
      targetDepartmentCode: string | null
      excludedEmployeeIds: ReadonlySet<EmployeeId>
      dueAt: Date | null
      decidedAt: Date
    }>,
  ): Promise<boolean | Error> {
    const includeEscalation = input.dueAt !== null && input.decidedAt >= input.dueAt
    const matches = await new ResolveCompanyProcedureApproverMatchesAdapter({
      c: this.c,
      applicantEmployeeId: input.subjectEmployeeId,
      selectors: includeEscalation
        ? [...input.step.approvers, ...input.step.escalation_approvers]
        : input.step.approvers,
      resolvedAt: input.decidedAt.toISOString(),
      targetDepartmentCode: input.targetDepartmentCode,
    }).resolveWorkflowApproverMatches()

    if (matches instanceof Error) return matches

    return matches.some(
      (match) =>
        match.accountId === input.representedAccountId &&
        !input.excludedEmployeeIds.has(match.employeeId),
    )
  }
}
