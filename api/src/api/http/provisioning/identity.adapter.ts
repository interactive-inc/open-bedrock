import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { SystemIdentityByEmailAdapter } from "@system/infrastructure/adapters/identity/system-identity-by-email.adapter"
import { SystemIdentityProfileUpdateAdapter } from "@system/infrastructure/adapters/identity/system-identity-profile-update.adapter"
import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"

export type ProviderIdentity = {
  identityId: IdentityId
  accountId: AccountId
  accountStatus: string
  tokenVersion: number
  employeeId: EmployeeId | null
  email: string | null
  employeeName: string | null
  profileDisplayName: string | null
}

export type AccountAuthState = {
  accountId: AccountId
  accountStatus: string
  tokenVersion: number
  employeeId: EmployeeId | null
}

type CompanyIdentityProjection = Readonly<{
  employee_id: EmployeeId | null
  employee_name: string | null
  profile_display_name: string | null
}>

/** System Identity と Company Employee/Profile の明示的な読み取り合成。 */
export class IdentityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByProviderSubject(
    provider: IdentityProvider,
    subjectInput: string,
  ): Promise<ProviderIdentity | null | Error> {
    const subject = identitySubjectSchema.safeParse(subjectInput)
    if (!subject.success) return null
    const login = await new SystemIdentityLoginAdapter({ env: { DB: this.c.env.DB } }).find(
      provider,
      subject.data,
    )
    if (login === null || login instanceof Error) return login
    const identity = await new SystemIdentityCatalogRepository({
      env: { DB: this.c.env.DB },
    }).find(login.identity.id)
    if (identity === null || identity instanceof Error) return identity

    try {
      const company = await this.c.env.DB.prepare(
        `SELECT link.employee_id, employee.official_name AS employee_name,
                profile.display_name AS profile_display_name
         FROM (SELECT ?1 AS account_id) source
         LEFT JOIN company_account_employee_links link ON link.account_id = source.account_id
         LEFT JOIN company_employees employee ON employee.id = link.employee_id
         LEFT JOIN company_account_profiles profile
           ON profile.organization_id = 'organization:default'
          AND profile.account_id = source.account_id
         LIMIT 1`,
      )
        .bind(login.account.id)
        .first<CompanyIdentityProjection>()

      return {
        identityId: login.identity.id,
        accountId: login.account.id,
        accountStatus: login.account.status,
        tokenVersion: login.account.tokenVersion,
        employeeId: company?.employee_id ?? null,
        email: identity.email,
        employeeName: company?.employee_name ?? null,
        profileDisplayName: company?.profile_display_name ?? null,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to compose Company Identity")
    }
  }

  async findAccountIdByEmail(email: string): Promise<AccountId | null | Error> {
    const identity = await new SystemIdentityByEmailAdapter({
      env: { DB: this.c.env.DB },
    }).execute(email)
    return identity instanceof Error ? identity : (identity?.accountId ?? null)
  }

  async findAccountById(accountId: AccountId): Promise<AccountAuthState | null | Error> {
    const account = await new SystemAccountRepository({ database: this.c.env.DB }).find(accountId)
    if (account === null || account instanceof Error) return account

    try {
      const employeeId = await this.c.env.DB.prepare(
        "SELECT employee_id FROM company_account_employee_links WHERE account_id = ?1 LIMIT 1",
      )
        .bind(accountId)
        .first<EmployeeId>("employee_id")

      return {
        accountId: account.id,
        accountStatus: account.status,
        tokenVersion: account.tokenVersion,
        employeeId,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to compose Company Account")
    }
  }

  async updateProvisionedIdentity(
    identityId: IdentityId,
    accountId: AccountId,
    employeeId: EmployeeId | null,
    email: string,
    name: string,
  ): Promise<null | Error> {
    try {
      const statements: D1PreparedStatement[] = [
        new SystemIdentityProfileUpdateAdapter({ env: { DB: this.c.env.DB } }).prepare(
          identityId,
          email,
          new Date(this.c.env.NOW ?? Date.now()),
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `UPDATE company_account_profiles
           SET display_name = ?2,
               updated_at = max(updated_at + 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
           WHERE organization_id = 'organization:default' AND account_id = ?1`,
        ).bind(accountId, name),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ]
      if (employeeId !== null) {
        statements.push(
          this.c.env.DB.prepare(
            "UPDATE company_employees SET official_name = ?2, email = ?3, updated_at = max(updated_at + 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000) WHERE id = ?1",
          ).bind(employeeId, name, email),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        )
      }
      await this.c.env.DB.batch(statements)
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update provisioned identity")
    }
  }

  async findEmployeeIdByEmail(email: string): Promise<EmployeeId | null | Error> {
    const identity = await new SystemIdentityByEmailAdapter({
      env: { DB: this.c.env.DB },
    }).execute(email)
    if (identity === null || identity instanceof Error) return identity

    try {
      return await this.c.env.DB.prepare(
        "SELECT employee_id FROM company_account_employee_links WHERE account_id = ?1 LIMIT 1",
      )
        .bind(identity.accountId)
        .first<EmployeeId>("employee_id")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find Company Employee link")
    }
  }

  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<Map<EmployeeId, string> | Error> {
    if (employeeIds.length === 0) return new Map()

    try {
      const links = await this.c.env.DB.prepare(
        `SELECT employee_id, account_id
         FROM company_account_employee_links
         WHERE employee_id IN (SELECT CAST(value AS TEXT) FROM json_each(?1))
         ORDER BY employee_id, account_id`,
      )
        .bind(JSON.stringify(employeeIds))
        .all<{ employee_id: EmployeeId; account_id: AccountId }>()
      const identities = await Promise.all(
        links.results.map((link) =>
          new SystemIdentityCatalogRepository({ env: { DB: this.c.env.DB } }).findMany(
            link.account_id,
          ),
        ),
      )
      const unavailable = identities.find((entries) => entries instanceof Error)
      if (unavailable instanceof Error) return unavailable

      const emails = new Map<EmployeeId, string>()
      for (const [index, link] of links.results.entries()) {
        const entries = identities[index]
        if (entries instanceof Error || entries === undefined) continue
        const preferred = entries
          .filter((entry) => entry.binding.state === "active" && entry.email !== null)
          .toSorted((left, right) =>
            left.binding.provider === right.binding.provider
              ? left.binding.createdAt.getTime() - right.binding.createdAt.getTime()
              : left.binding.provider === "password"
                ? -1
                : 1,
          )
          .at(0)
        if (preferred?.email !== null && preferred?.email !== undefined) {
          emails.set(link.employee_id, preferred.email)
        }
      }

      return emails
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve Company emails")
    }
  }
}
