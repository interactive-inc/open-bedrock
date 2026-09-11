import type { KnowledgeContext as Context } from "@/contexts/knowledge/configuration/knowledge-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ForbiddenError, UnavailableError } from "@/lib/errors"

/** 現在の認証・職員対応を確認し、保存時にも失効・異動・日付境界を再検査する。 */
export class KnowledgeAuthorAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(authorId: EmployeeId) {
    const authentication = this.c.var.bearerReadAuthentication
    const now = this.c.var.now()
    if (authentication === undefined || authentication.accountId !== this.c.var.userId)
      return new ForbiddenError("current authentication is required", "knowledge_author_forbidden")
    const system = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      now,
    )
    if (system instanceof Error)
      return new UnavailableError(
        "knowledge authorization is unavailable",
        "knowledge_unavailable",
        { cause: system },
      )
    if (system === null)
      return new ForbiddenError("authentication expired", "knowledge_author_forbidden")
    const accountId = zAccountId.parse(authentication.accountId)
    const company = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [accountId], employeeCodes: [] })
    if (company instanceof Error)
      return new UnavailableError("Company is unavailable", "knowledge_unavailable", {
        cause: company,
      })
    const directory = new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: this.c.env.DB,
        NOW: now.toISOString(),
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
      },
    })
    const actors = await directory.findForAccountIds([accountId])
    if (actors instanceof Error)
      return new UnavailableError("Company is unavailable", "knowledge_unavailable", {
        cause: actors,
      })
    const actor = actors[0]?.employee
    if (
      actors.length !== 1 ||
      actor?.id !== authorId ||
      actor.employment === null ||
      actor.employment.status === "TERMINATED"
    )
      return new ForbiddenError(
        "current author employment is required",
        "knowledge_author_forbidden",
      )
    const dateAt = (ms: number) =>
      resolveCompanyBusinessDate({
        now: new Date(ms).toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
    const day = dateAt(now.getTime())
    if (day instanceof Error)
      return new UnavailableError("Company date is unavailable", "knowledge_unavailable", {
        cause: day,
      })
    let lower = now.getTime()
    let upper = lower + 48 * 60 * 60 * 1000
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2)
      if (dateAt(middle) === day) lower = middle
      else upper = middle
    }
    const assertions = system.assertions(now)
    if (assertions instanceof Error)
      return new UnavailableError(
        "knowledge authorization is unavailable",
        "knowledge_unavailable",
        { cause: assertions },
      )
    return {
      accountId,
      now,
      assertions: [
        ...assertions,
        company,
        this.c.env.DB.prepare(
          "SELECT CASE WHEN max(?1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) < ?2 THEN 1 ELSE json_extract('{}','knowledge_business_date_changed') END",
        ).bind(now.getTime(), upper),
      ],
    }
  }
}
