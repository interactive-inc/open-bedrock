import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration.repository"
import { PrepareSystemAccountProvisioning } from "@system/infrastructure/identity/prepare-system-account-provisioning.repository"
import type { Context } from "@/env"

/** machine provisioningでCompany EmployeeとSystem Accountを原子的に作る。 */
export class ProvisionExternalEmployee {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: {
    provider: IdentityProvider
    subject: string
    email: string
    name: string
    roleKey: string
    now: Date
  }): Promise<number | Error> {
    const roles = await new SystemRoleAdministrationRepository({
      env: { DB: this.c.env.DB },
    }).list()
    if (roles instanceof Error) return roles
    const role = roles.find((candidate) => candidate.key === `company:${input.roleKey}`)
    if (role === undefined) return new Error("System provisioning role not found")
    const system = new PrepareSystemAccountProvisioning({ env: { DB: this.c.env.DB } }).prepare({
      actorAccountId: null,
      provider: input.provider,
      subject: input.subject,
      email: input.email,
      passwordHash: null,
      roleId: role.id,
      now: input.now,
    })
    if (system instanceof Error) return system
    const database = this.c.env.DB

    try {
      const results = await database.batch([
        system.accountStatement,
        database
          .prepare("INSERT INTO employees (code, name, status) VALUES (NULL, ?1, 'active')")
          .bind(input.name),
        database
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             VALUES (?1, last_insert_rowid())`,
          )
          .bind(system.accountId),
        database
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
          )
          .bind(system.accountId, input.name, input.now.getTime()),
        ...system.identityStatements,
      ])
      const employeeId = results[1]?.meta?.last_row_id
      return employeeId === undefined
        ? new Error("failed to retrieve provisioned Employee ID")
        : employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision external Employee")
    }
  }
}
