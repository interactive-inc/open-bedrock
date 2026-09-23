import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { TrainingContext } from "@/contexts/training/configuration/training-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { TrainingError } from "@/contexts/training/domain/errors"

type Context = TrainingContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class TrainingActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const account = zAccountId.safeParse(this.c.var.userId)
    if (!account.success || !Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new TrainingError("forbidden", "invalid training actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: account.data,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["system:record:preserve"],
      now,
    })
    if (authorization instanceof Error)
      return new TrainingError("training_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new TrainingError("forbidden", "human record preserver is required")
    const guard = await prepareCompanyAuthoritySnapshotGuard({
      database: this.c.env.DB,
    }, {
      accountIds: [account.data],
      employeeCodes: [],
    })
    if (guard instanceof Error)
      return new TrainingError("training_unavailable", "Company snapshot is unavailable", {
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
      return new TrainingError("training_unavailable", "Company directory is unavailable")
    if (actors[0]?.employee === undefined)
      return new TrainingError("forbidden", "active employee is required")
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
