import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { ExpenseProcedureReadAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-read.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError, UnprocessableError } from "@/lib/errors"

type Context = CompanyContext

const snapshotSql = `SELECT json_array(expense.employee_id,expense.organization_unit_id,expense.category,
  expense.amount,expense.spent_at,expense.note,expense.status,expense.created_at,
  binding.case_id,binding.application_id,binding.proposal_digest,binding.attachment_evidence_json,
  (SELECT json_group_array(attachment_id) FROM (SELECT attachment_id FROM expense_attachments WHERE expense_id=?1 ORDER BY attachment_id))
) AS snapshot,binding.case_id FROM expenses expense LEFT JOIN expense_procedure_bindings binding ON binding.expense_id=expense.id
WHERE expense.id=?1 AND EXISTS (SELECT 1 FROM expense_attachments WHERE expense_id=?1 AND attachment_id=?2)`

/** 現在の経費閲覧資格と復号対象を固定し、最終監査の前後へ渡す検査を準備する。 */
export class PrepareExpenseAttachmentReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      expenseId: number
      attachmentId: string
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
      at: Date
    }>,
  ) {
    const authorization = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      input.authentication,
      input.at,
    )
    if (authorization instanceof Error)
      return new UnexpectedError("閲覧資格を確認できません", { cause: authorization })
    if (authorization === null || input.authentication.accountId !== input.session.accountId)
      return new ForbiddenError("閲覧資格が失効しています", "read_authorization_changed")
    const company = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [input.session.accountId], employeeCodes: [] })
    if (company instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: company })
    const people = await new CompanyEmployeeDirectoryReadAdapter({
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
        .bind(input.expenseId, input.attachmentId)
        .first<{ snapshot: string; case_id: string | null }>()
      if (target === null) return new NotFoundError("添付が見つかりません", "attachment_not_found")
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
      const evidence = view.attachments.find((attachment) => attachment.id === input.attachmentId)
      const attachment = await new AttachmentAdapter(this.c).findById(input.attachmentId)
      if (attachment instanceof Error)
        return new UnexpectedError("添付を固定できません", { cause: attachment })
      if (attachment === null || evidence === undefined)
        return new NotFoundError("添付が見つかりません", "attachment_not_found")
      if (
        !view.evidence_available ||
        attachment.status !== "linked" ||
        attachment.wrappedDek === null ||
        attachment.wrappedDekIv === null ||
        attachment.plaintextSha256 !== evidence.sha256 ||
        attachment.fileName !== evidence.file_name ||
        attachment.contentType !== evidence.content_type ||
        attachment.byteSize !== evidence.byte_size
      )
        return new UnprocessableError("確認した添付を利用できません", "attachment_evidence_changed")
      const businessDate = resolveCompanyBusinessDate({
        now: input.at.toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (businessDate instanceof Error)
        return new UnexpectedError("会社営業日を確認できません", { cause: businessDate })
      const targetGuard = this.c.env.DB.prepare(
        `SELECT CASE WHEN EXISTS (SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?3) THEN 1 ELSE json_extract('{}','expense_attachment_read_changed') END`,
      ).bind(input.expenseId, input.attachmentId, target.snapshot)
      return {
        attachment,
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
          return [
            ...system,
            company,
            targetGuard,
            ...(workflow === null ? [] : [workflow(now)]),
            new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(attachment, now),
          ]
        },
      }
    } catch (cause) {
      return new UnexpectedError("添付の開示を準備できません", { cause })
    }
  }
}
