import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"

/** 現在の本人対応と在籍を確認し、保存時にも同じ会社資格を要求する。 */
export class PrepareLeaveHumanEmployeeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ accountId: AccountId; employeeId: EmployeeId; now: Date }>) {
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [input.accountId],
      employeeCodes: [],
    })
    if (guard instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: guard })
    const linked = await new CompanyEmployeeDirectoryReadAdapter({
      ...this.c,
      env: { ...this.c.env, NOW: input.now.toISOString() },
    }).findForAccountIds([input.accountId])
    if (linked instanceof Error)
      return new UnexpectedError("従業員を取得できません", { cause: linked })
    const employee = linked.at(0)?.employee
    if (
      linked.length !== 1 ||
      employee?.id !== input.employeeId ||
      employee.employment?.status !== "ACTIVE"
    )
      return new ForbiddenError("在籍中の本人を確認できません", "forbidden")
    return { employee, employmentStatus: employee.employment.status, guard }
  }
}
