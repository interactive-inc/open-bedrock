import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { HealthCheckupContext } from "@/contexts/health-checkup/configuration/health-checkup-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { prepareSystemHumanOperationAuthorization } from "@system/interface/operations/prepare-system-human-operation-authorization"
import { HealthCheckupError } from "@/contexts/health-checkup/domain/errors"

type Context = HealthCheckupContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class HealthCheckupActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const accountId = this.c.var.userId
    if (!Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new HealthCheckupError("forbidden", "invalid health-checkup actor")
    const authorization = await prepareSystemHumanOperationAuthorization({
      database: this.c.env.DB,
      accountId,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["health_checkup:manage"],
      now,
    })
    if (authorization instanceof Error)
      return new HealthCheckupError("health_checkup_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new HealthCheckupError("forbidden", "human health-checkup manager is required")
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
      return new HealthCheckupError(
        "health_checkup_unavailable",
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
      return new HealthCheckupError(
        "health_checkup_unavailable",
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
