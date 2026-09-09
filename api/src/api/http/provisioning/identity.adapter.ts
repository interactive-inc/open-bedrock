import { ReadCompanyAccountDisplayNamesAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/read-company-account-display-names.adapter"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { SystemIdentityByEmailAdapter } from "@system/infrastructure/adapters/identity/system-identity-by-email.adapter"
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
      const now = this.c.env.NOW ?? new Date().toISOString()
      const employees = await new CompanyEmployeeDirectoryReadAdapter({
        env: { ...this.c.env, NOW: now },
      }).findForAccountIds([login.account.id])
      if (employees instanceof Error) return employees
      const employee = employees[0]?.employee
      const displayNames = await new ReadCompanyAccountDisplayNamesAdapter({
        database: this.c.env.DB,
        organizationIds: ["organization:default"],
        accountIds: [login.account.id],
        now,
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      }).readCompanyAccountDisplayNames()

      return {
        identityId: login.identity.id,
        accountId: login.account.id,
        accountStatus: login.account.status,
        tokenVersion: login.account.tokenVersion,
        employeeId: employee?.id ?? null,
        email: identity.email,
        employeeName: employee?.officialName ?? null,
        profileDisplayName: displayNames.get(login.account.id) ?? null,
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
      const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
        accountIds: [accountId],
      })
      if (links instanceof Error) return links
      const employeeId = links[0]?.employeeId ?? null

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

  async findEmployeeIdByEmail(email: string): Promise<EmployeeId | null | Error> {
    const identity = await new SystemIdentityByEmailAdapter({
      env: { DB: this.c.env.DB },
    }).execute(email)
    if (identity === null || identity instanceof Error) return identity

    try {
      const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
        accountIds: [identity.accountId],
      })
      if (links instanceof Error) return links
      return links[0]?.employeeId ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find Company Employee link")
    }
  }

  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<Map<EmployeeId, string> | Error> {
    if (employeeIds.length === 0) return new Map()

    try {
      const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
        employeeIds,
      })
      if (links instanceof Error) return links
      const identities = await Promise.all(
        links.map((link) =>
          new SystemIdentityCatalogRepository({ env: { DB: this.c.env.DB } }).findMany(
            zAccountId.parse(link.accountId),
          ),
        ),
      )
      const unavailable = identities.find((entries) => entries instanceof Error)
      if (unavailable instanceof Error) return unavailable

      const emails = new Map<EmployeeId, string>()
      for (const [index, link] of links.entries()) {
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
          emails.set(link.employeeId, preferred.email)
        }
      }

      return emails
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve Company emails")
    }
  }
}
