import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { ExpenseProcedureReadAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-read.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = CompanyContext

const snapshotSql = `SELECT json_array(expense.employee_id,expense.organization_unit_id,expense.category,
  expense.amount,expense.spent_at,expense.note,expense.status,expense.created_at,
  binding.request_key,binding.previous_expense_id,binding.case_id,binding.application_id,
  binding.series_id,binding.proposal_digest,binding.attachment_evidence_json,binding.created_at,
  (SELECT json_group_array(json_array(attachment_id,created_at)) FROM (SELECT attachment_id,created_at FROM expense_attachments WHERE expense_id=?1 ORDER BY attachment_id))
) AS snapshot,binding.case_id FROM expenses expense LEFT JOIN expense_procedure_bindings binding ON binding.expense_id=expense.id
WHERE expense.id=?1`

/** 現在の経費閲覧資格と申請・案件・添付対応を固定し、保存と開示へ検査を渡す。 */
export class PrepareExpenseRecordReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      expenseId: number
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
      at: Date
    }>,
  ) {
    const authorization = await prepareSystemReadAuthorization({
      database: this.c.env.DB,
      authentication: input.authentication,
      at: input.at,
    })
    if (authorization instanceof Error)
      return new UnexpectedError("閲覧資格を確認できません", { cause: authorization })
    if (authorization === null || input.authentication.accountId !== input.session.accountId)
      return new ForbiddenError("閲覧資格が失効しています", "read_authorization_changed")
    const company = await prepareCompanyAuthoritySnapshotGuard(
      {
        database: this.c.env.DB,
      },
      { accountIds: [input.session.accountId], employeeCodes: [] },
    )
    if (company instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: company })
    const people = await openCompanyEmployeeDirectory({
      env: { ...this.c.env, NOW: input.at.toISOString() },
    }).findForAccountIds([input.session.accountId])
    if (people instanceof Error)
      return new UnexpectedError("在籍を確認できません", { cause: people })
    const employee = people.at(0)?.employee
    if (
      employee?.id !== input.session.employeeId ||
      (employee.employment?.status !== "ACTIVE" && employee.employment?.status !== "ON_LEAVE")
    )
      return new ForbiddenError("現在の在籍を確認できません", "read_authorization_changed")
    try {
      const target = await this.c.env.DB.prepare(snapshotSql)
        .bind(input.expenseId)
        .first<{ snapshot: string; case_id: string | null }>()
      if (target === null) return new NotFoundError("経費が見つかりません", "expense_not_found")
      const workflow =
        target.case_id === null
          ? null
          : await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
              caseId: target.case_id,
              accountId: input.session.accountId,
              at: input.at,
            })
      if (workflow instanceof Error)
        return new UnexpectedError("案件を固定できません", { cause: workflow })
      const session = {
        accountId: input.session.accountId,
        employeeId: employee.id,
        hasPermission: (permission: string) => authorization.permissionKeys.has(permission),
      }
      const view = await new ExpenseProcedureReadAdapter(this.c).find({
        expenseId: input.expenseId,
        session,
        tokenVersion: input.authentication.tokenVersion,
        at: input.at,
      })
      if (view instanceof Error) return view
      const businessDate = resolveCompanyBusinessDate({
        now: input.at.toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (businessDate instanceof Error)
        return new UnexpectedError("会社営業日を確認できません", { cause: businessDate })
      const targetGuard = this.c.env.DB.prepare(
        `SELECT CASE WHEN EXISTS (SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?2) THEN 1 ELSE json_extract('{}','expense_record_read_changed') END`,
      ).bind(input.expenseId, target.snapshot)
      return {
        view,
        session,
        assertions: (now: Date): ReadonlyArray<D1PreparedStatement> | Error => {
          const currentDate = resolveCompanyBusinessDate({
            now: now.toISOString(),
            timeZone: this.c.env.COMPANY_TIME_ZONE,
          })
          if (currentDate !== businessDate)
            return new ForbiddenError("営業日が変わりました", "read_authorization_changed")
          const system = authorization.assertions(now)
          if (system instanceof Error) return system
          return [...system, company, targetGuard, ...(workflow === null ? [] : [workflow(now)])]
        },
      }
    } catch (cause) {
      return new UnexpectedError("経費の参照を準備できません", { cause })
    }
  }
}
