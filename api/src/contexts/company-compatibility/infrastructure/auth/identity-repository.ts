import type { Context } from "@/env"
import type { IdentityProvider } from "@/contexts/system/domain/identity/identity-provider"
import { identitySubjectSchema } from "@/contexts/system/domain/identity/identity-subject"
import type { AccountId } from "@system/domain/auth/account-id"
import { zIdentityId, type IdentityId } from "@system/domain/identity/identity-id"

export type ProviderIdentity = {
  identityId: IdentityId
  accountId: number
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
  email: string | null
  employeeName: string | null
}

export type AccountAuthState = {
  accountId: number
  accountStatus: string
  tokenVersion: number
  employeeId: number | null
}

type IdentityRow = {
  identity_id: string
  account_id: string
  account_status: string
  token_version: number
  employee_id: number | null
  email: string | null
  employee_name: string | null
}

function toNumericId(value: string): number | Error {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value
    ? parsed
    : new Error("canonical System ID is not compatible with the numeric product API")
}

/** Product APIの数値IDをcanonical System Identity / Accountへ接続する。 */
export class IdentityRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByProviderSubject(
    provider: IdentityProvider,
    subjectInput: string,
  ): Promise<ProviderIdentity | null | Error> {
    const subject = identitySubjectSchema.safeParse(subjectInput)
    if (!subject.success) return null

    const found = await this.findIdentity(provider, subject.data)
    if (found === null || found instanceof Error) return found
    const identityId = zIdentityId.safeParse(found.identity_id)
    const accountId = toNumericId(found.account_id)
    if (!identityId.success) return identityId.error
    if (accountId instanceof Error) return accountId

    return {
      identityId: identityId.data,
      accountId,
      accountStatus: found.account_status,
      tokenVersion: found.token_version,
      employeeId: found.employee_id,
      email: found.email,
      employeeName: found.employee_name,
    }
  }

  async findAccountIdByEmail(email: string): Promise<number | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT binding.account_id
         FROM system_identity_profiles profile
         INNER JOIN system_identity_bindings binding ON binding.id = profile.identity_id
         WHERE lower(profile.email) = lower(?1)
         ORDER BY binding.id
         LIMIT 1`,
      )
        .bind(email)
        .first<{ account_id: string }>()
      if (row === null) return null
      return toNumericId(row.account_id)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity by email")
    }
  }

  async findAccountById(accountId: AccountId): Promise<AccountAuthState | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT
           account.id AS account_id,
           account.status AS account_status,
           account.token_version,
           link.employee_id
         FROM system_accounts account
         LEFT JOIN account_employee_links link
           ON account.id = link.account_id
         WHERE account.id = ?1
         LIMIT 1`,
      )
        .bind(accountId)
        .first<{
          account_id: string
          account_status: string
          token_version: number
          employee_id: number | null
        }>()
      if (row === null) return null
      const parsedAccountId = toNumericId(row.account_id)
      if (parsedAccountId instanceof Error) return parsedAccountId
      return {
        accountId: parsedAccountId,
        accountStatus: row.account_status,
        tokenVersion: row.token_version,
        employeeId: row.employee_id,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find account")
    }
  }

  async updateProvisionedIdentity(
    identityId: IdentityId,
    employeeId: number | null,
    email: string,
    name: string,
  ): Promise<null | Error> {
    try {
      const statements: D1PreparedStatement[] = [
        this.c.env.DB.prepare(
          `UPDATE system_identity_profiles
           SET email = ?2, updated_at = max(updated_at + 1, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
           WHERE identity_id = ?1`,
        ).bind(String(identityId), email),
      ]
      if (employeeId !== null) {
        statements.push(
          this.c.env.DB.prepare("UPDATE employees SET name = ?2 WHERE id = ?1").bind(
            employeeId,
            name,
          ),
        )
      }
      await this.c.env.DB.batch(statements)
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to update provisioned identity")
    }
  }

  async findEmployeeIdByEmail(email: string): Promise<number | null | Error> {
    const subject = identitySubjectSchema.safeParse(email.toLowerCase())
    if (!subject.success) return null

    try {
      return await this.c.env.DB.prepare(
        `SELECT link.employee_id
         FROM system_identity_bindings identity
         INNER JOIN account_employee_links link
           ON link.account_id = identity.account_id
         WHERE identity.provider = 'password' AND identity.subject = ?1
         LIMIT 1`,
      )
        .bind(subject.data)
        .first<number>("employee_id")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }

  async findEmailsByEmployeeIds(
    employeeIds: ReadonlyArray<number>,
  ): Promise<Map<number, string> | Error> {
    if (employeeIds.length === 0) return new Map()

    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT link.employee_id, profile.email
         FROM account_employee_links link
         INNER JOIN system_identity_bindings identity
           ON identity.account_id = link.account_id
         INNER JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         WHERE link.employee_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?1))
           AND profile.email IS NOT NULL
         ORDER BY
           link.employee_id,
           CASE WHEN identity.provider = 'password' THEN 0 ELSE 1 END,
           identity.created_at,
           identity.id`,
      )
        .bind(JSON.stringify(employeeIds))
        .all<{ employee_id: number; email: string }>()
      const emails = new Map<number, string>()
      for (const row of rows.results) {
        if (!emails.has(row.employee_id)) emails.set(row.employee_id, row.email)
      }
      return emails
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve emails")
    }
  }

  private async findIdentity(
    provider: IdentityProvider,
    subject: string,
  ): Promise<IdentityRow | null | Error> {
    try {
      return await this.c.env.DB.prepare(
        `SELECT
           identity.id AS identity_id,
           identity.account_id,
           account.status AS account_status,
           account.token_version,
           link.employee_id,
           profile.email,
           employee.name AS employee_name
         FROM system_identity_bindings identity
         INNER JOIN system_accounts account ON account.id = identity.account_id
         LEFT JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         LEFT JOIN account_employee_links link
           ON link.account_id = account.id
         LEFT JOIN employees employee ON employee.id = link.employee_id
         WHERE identity.provider = ?1
           AND identity.subject = ?2
           AND identity.activated_at IS NOT NULL
           AND identity.revoked_at IS NULL
         LIMIT 1`,
      )
        .bind(provider, subject)
        .first<IdentityRow>()
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find identity")
    }
  }
}
