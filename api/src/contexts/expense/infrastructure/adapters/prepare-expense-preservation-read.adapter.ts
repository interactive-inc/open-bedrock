import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"

type Context = CompanyContext

/** 保全対象の明示的な読取権限と在籍資格を確認し、保全確定時にも再検査する。 */
export class PrepareExpensePreservationReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      authentication: SystemReadAuthentication
      session?: CompanyPersonnelSession
      permission: "budget:manage" | "expense:read:all"
      at: Date
    }>,
  ) {
    const authorization = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      input.authentication,
      input.at,
    )
    if (authorization instanceof Error)
      return new UnexpectedError("閲覧資格を確認できません", { cause: authorization })
    if (
      authorization === null ||
      (input.session !== undefined && input.authentication.accountId !== input.session.accountId)
    )
      return new ForbiddenError("閲覧資格が失効しています", "read_authorization_changed")
    if (!authorization.permissionKeys.has(input.permission))
      return new ForbiddenError("保全対象を参照する権限がありません", "forbidden")
    const company = await prepareCompanyAuthoritySnapshotGuard({
      database: this.c.env.DB,
    }, { accountIds: [input.authentication.accountId], employeeCodes: [] })
    if (company instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: company })
    const people = await openCompanyEmployeeDirectory({
      env: { ...this.c.env, NOW: input.at.toISOString() },
    }).findForAccountIds([input.authentication.accountId])
    if (people instanceof Error)
      return new UnexpectedError("在籍を確認できません", { cause: people })
    const employee = people.at(0)?.employee
    if (
      people.length !== 1 ||
      employee === undefined ||
      (input.session !== undefined && employee.id !== input.session.employeeId) ||
      (employee.employment?.status !== "ACTIVE" && employee.employment?.status !== "ON_LEAVE")
    )
      return new ForbiddenError("現在の在籍を確認できません", "read_authorization_changed")
    try {
      const businessDate = resolveCompanyBusinessDate({
        now: input.at.toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (businessDate instanceof Error)
        return new UnexpectedError("会社営業日を確認できません", { cause: businessDate })
      const session: CompanyPersonnelSession = Object.freeze({
        accountId: input.authentication.accountId,
        employeeId: employee.id,
        hasPermission: (permission: string) => authorization.permissionKeys.has(permission),
      })
      return {
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
          return [...system, company]
        },
      }
    } catch (cause) {
      return new UnexpectedError("保全対象の参照を準備できません", { cause })
    }
  }
}
