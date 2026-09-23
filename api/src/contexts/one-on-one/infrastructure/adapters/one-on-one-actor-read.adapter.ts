import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { OneOnOneContext } from "@/contexts/one-on-one/configuration/one-on-one-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { OneOnOneError } from "@/contexts/one-on-one/domain/errors"

type Context = OneOnOneContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class OneOnOneActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const account = zAccountId.safeParse(this.c.var.userId)
    if (!account.success || !Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new OneOnOneError("forbidden", "invalid one-on-one actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: account.data,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["oneonone:create"],
      now,
    })
    if (authorization instanceof Error)
      return new OneOnOneError("one_on_one_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new OneOnOneError("forbidden", "human one-on-one manager is required")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      {
        database: this.c.env.DB,
      },
      {
        accountIds: [account.data],
        employeeCodes: [],
      },
    )
    if (guard instanceof Error)
      return new OneOnOneError("one_on_one_unavailable", "Company snapshot is unavailable", {
        cause: guard,
      })
    const directory = openCompanyEmployeeDirectory({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: now.toISOString(),
      },
    })
    const actors = await directory.findForAccountIds([account.data])
    const employees = await directory.findForEmployeeIds(employeeIds)
    if (actors instanceof Error || employees instanceof Error)
      return new OneOnOneError("one_on_one_unavailable", "Company directory is unavailable")
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
