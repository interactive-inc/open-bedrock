import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"
import type { Context } from "@/env"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

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
  }): Promise<EmployeeId | Error> {
    const roles = await new SystemRoleCatalogRepository({
      env: { DB: this.c.env.DB },
    }).findMany()
    if (roles instanceof Error) return roles
    const role = roles.find((candidate) => candidate.key === `company:${input.roleKey}`)
    if (role === undefined) return new Error("System provisioning role not found")
    const system = new SystemAccountProvisioningAdapter({ env: { DB: this.c.env.DB } }).prepare({
      actorAccountId: null,
      provider: input.provider,
      subject: input.subject,
      email: input.email,
      passwordHash: null,
      roleId: role.id,
      now: input.now,
    })
    if (system instanceof Error) return system
    const businessDate = resolveCompanyBusinessDate({
      now: input.now.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) return businessDate
    const employeeId = restoreWorkforceId("employee", crypto.randomUUID())
    const employmentId = restoreWorkforceId("employment", crypto.randomUUID())
    const now = input.now.getTime()
    const database = this.c.env.DB

    try {
      await database.batch([
        system.accountStatement,
        database
          .prepare(
            `INSERT INTO company_employees
               (id, official_name, employee_code, email, phone, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, NULL, ?4, ?4)`,
          )
          .bind(employeeId, input.name, input.email, now),
        database
          .prepare(
            `INSERT INTO company_employments
               (id, employee_id, contract_name, employment_type, hire_date, status,
                termination_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'FULL_TIME', ?4, 'ACTIVE', NULL, ?5, ?5)`,
          )
          .bind(employmentId, employeeId, input.name, businessDate, now),
        database
          .prepare(
            `INSERT INTO company_account_employee_links (account_id, employee_id)
             VALUES (?1, ?2)`,
          )
          .bind(system.accountId, employeeId),
        database
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
          )
          .bind(system.accountId, input.name, now),
        ...system.identityStatements,
      ])
      return employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision external Employee")
    }
  }
}
