import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { EmployeeWorkStyleContext } from "@/contexts/work-style/configuration/work-style-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { EmployeeWorkStyleError } from "@/contexts/work-style/domain/errors"

type Context = EmployeeWorkStyleContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class EmployeeWorkStyleActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const accountId = this.c.var.userId
    if (!Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new EmployeeWorkStyleError("forbidden", "invalid work-style actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["work_style:manage"],
      now,
    })
    if (authorization instanceof Error)
      return new EmployeeWorkStyleError("work_style_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new EmployeeWorkStyleError("forbidden", "human work-style manager is required")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      {
        database: this.c.env.DB,
      },
      {
        accountIds: [accountId],
        employeeCodes: [],
      },
    )
    if (guard instanceof Error)
      return new EmployeeWorkStyleError(
        "work_style_unavailable",
        "Company snapshot is unavailable",
        {
          cause: guard,
        },
      )
    const directory = openCompanyEmployeeDirectory({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: now.toISOString(),
      },
    })
    const actors = await directory.findForAccountIds([accountId])
    const employees = await directory.findForEmployeeIds(employeeIds)
    if (actors instanceof Error || employees instanceof Error)
      return new EmployeeWorkStyleError(
        "work_style_unavailable",
        "Company directory is unavailable",
      )
    return {
      actor: actors[0]?.employee ?? null,
      employees,
      accountId,
      principalId: authorization.principalId,
      now,
      assertions: [...authorization.assertions, guard],
    }
  }
}
