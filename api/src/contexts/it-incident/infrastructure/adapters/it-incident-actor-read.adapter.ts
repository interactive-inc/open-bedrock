import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { ItIncidentContext } from "@/contexts/it-incident/configuration/it-incident-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { ItIncidentError } from "@/contexts/it-incident/domain/errors"

type Context = ItIncidentContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class ItIncidentActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const accountId = this.c.var.userId
    if (!Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new ItIncidentError("forbidden", "invalid it-incident actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["it_incident:manage"],
      now,
    })
    if (authorization instanceof Error)
      return new ItIncidentError("it_incident_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new ItIncidentError("forbidden", "human it-incident manager is required")
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
      return new ItIncidentError("it_incident_unavailable", "Company snapshot is unavailable", {
        cause: guard,
      })
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
      return new ItIncidentError("it_incident_unavailable", "Company directory is unavailable")
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
