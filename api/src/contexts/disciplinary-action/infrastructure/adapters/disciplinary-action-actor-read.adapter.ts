import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { DisciplinaryActionError } from "@/contexts/disciplinary-action/domain/errors"

type Context = DisciplinaryActionContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class DisciplinaryActionActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const account = zAccountId.safeParse(this.c.var.userId)
    if (!account.success || !Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new DisciplinaryActionError("forbidden", "invalid disciplinary-action actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: account.data,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["disciplinary_action:manage"],
      now,
    })
    if (authorization instanceof Error)
      return new DisciplinaryActionError("disciplinary_action_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new DisciplinaryActionError("forbidden", "human disciplinary-action manager is required")
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [account.data],
      employeeCodes: [],
    })
    if (guard instanceof Error)
      return new DisciplinaryActionError("disciplinary_action_unavailable", "Company snapshot is unavailable", {
        cause: guard,
      })
    const directory = new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: now.toISOString(),
      },
    })
    const actors = await directory.findForAccountIds([account.data])
    const employees = await directory.findForEmployeeIds(employeeIds)
    if (actors instanceof Error || employees instanceof Error)
      return new DisciplinaryActionError("disciplinary_action_unavailable", "Company directory is unavailable")
    return {
      actor: actors[0]?.employee ?? null,
      employees,
      accountId: account.data,
      principalId: authorization.principalId,
      now,
      assertions: [...authorization.assertions, guard],
    }
  }
}
