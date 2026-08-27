import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IamRoleId } from "@system/domain/schemas/iam/iam-role.schema"
import { PrepareSystemAccountProvisioning } from "@system/infrastructure/identity/prepare-system-account-provisioning.repository"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

/** 既存のCompany Employee作成batchへSystem Account一式を接続する。 */
export class PrepareEmployeeAccountProvisioningAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: {
    employeeCode: string
    email: string
    passwordHash: string
    roleId: IamRoleId
    actorAccountId: AccountId
    now: Date
  }): ReadonlyArray<D1PreparedStatement> | Error {
    const system = new PrepareSystemAccountProvisioning({
      env: { DB: this.c.env.DB },
    }).prepare({
      actorAccountId: input.actorAccountId,
      provider: "password",
      subject: input.email.toLowerCase(),
      email: input.email,
      passwordHash: input.passwordHash,
      roleId: input.roleId,
      now: input.now,
    })
    if (system instanceof Error) return system
    const database = this.c.env.DB

    return Object.freeze([
      system.accountStatement,
      database
        .prepare(
          `INSERT INTO account_employee_links (account_id, employee_id)
           SELECT ?2, id FROM employees WHERE code = ?1`,
        )
        .bind(input.employeeCode, system.accountId),
      abortWhenPreviousStatementChangedNoRows(database),
      database
        .prepare(
          `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           SELECT 'organization:default', ?2, name, ?3, ?3
           FROM employees WHERE code = ?1`,
        )
        .bind(input.employeeCode, system.accountId, input.now.getTime()),
      abortWhenPreviousStatementChangedNoRows(database),
      ...system.identityStatements,
    ])
  }
}
