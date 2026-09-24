import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import type { KnowledgeContext } from "@/contexts/knowledge/configuration/knowledge-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { KnowledgeError } from "@/contexts/knowledge/domain/errors"

type Context = KnowledgeContext

/** Systemの操作権限とCompanyの現在の対応を読み、保存時に照合する文を返す。 */
export class KnowledgeActorReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(employeeIds: ReadonlyArray<EmployeeId> = []) {
    const now = this.c.var.now()
    const accountId = this.c.var.userId
    if (!Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new KnowledgeError("forbidden", "invalid knowledge actor")
    const authorization = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId,
      tokenVersion: this.c.var.accountTokenVersion,
      permissions: ["system:record:preserve"],
      now,
    })
    if (authorization instanceof Error)
      return new KnowledgeError("knowledge_unavailable", "authorization is unavailable", {
        cause: authorization,
      })
    if (authorization === "forbidden")
      return new KnowledgeError("forbidden", "human record preserver is required")
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
      return new KnowledgeError("knowledge_unavailable", "Company snapshot is unavailable", {
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
      return new KnowledgeError("knowledge_unavailable", "Company directory is unavailable")
    if (actors[0]?.employee === undefined)
      return new KnowledgeError("forbidden", "active employee is required")
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
