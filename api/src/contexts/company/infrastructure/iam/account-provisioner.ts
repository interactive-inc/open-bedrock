import type { Context } from "@/env"
import type { IdentityProvider } from "@/contexts/system/domain/identity/identity-provider"
import type { AccountId } from "@system/domain/auth/account-id"
import { identitySubjectSchema } from "@/contexts/system/domain/identity/identity-subject"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { LivePermissionGuard } from "@/contexts/company/infrastructure/iam/live-permission-guard"
import { RoleAssignmentGuardError } from "@/contexts/company/infrastructure/iam/role-assignment-guard-error"

export type ProvisionInput = {
  employeeId: number
  email: string
  provider: IdentityProvider
  secret: string | null
  subject: string
  roleKey: string
  now: number
}

export type ProvisionExternalEmployeeInput = {
  provider: IdentityProvider
  subject: string
  email: string
  name: string
  roleKey: string
  now: number
}

export type AttachExternalIdentityInput = {
  accountId: AccountId
  provider: IdentityProvider
  subject: string
  email: string
  now: number
}

export type ProvisionWithEmployeeInput = {
  employee: {
    code: string
    name: string
    deptId: number | null
    deptName: string | null
    position: string | null
    status: string
  }
  email: string
  passwordHash: string
  roleKey: string
  grantedByAccountId: AccountId
  now: number
}

export type PreparedProvisionInput = {
  employeeCode: string
  email: string
  passwordHash: string
  roleKey: string
  grantedByAccountId: AccountId
  now: number
}

/** System Account / IdentityとCompany Employee linkを一つのtransactionで払い出す。 */
export class AccountProvisioner {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async provision(input: ProvisionInput): Promise<null | Error> {
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!subject.success) return new Error("invalid identity subject", { cause: subject.error })
    const words = crypto.getRandomValues(new Uint32Array(4))
    const accountId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const identityId = ((words[2] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[3] ?? 0) || 1
    const db = this.c.env.DB

    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, ?2, ?2)`,
          )
          .bind(String(accountId), input.now),
        db
          .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (?1, ?2)")
          .bind(String(accountId), input.employeeId),
        db
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             SELECT 'organization:default', ?1, name, ?3, ?3
             FROM employees WHERE id = ?2`,
          )
          .bind(String(accountId), input.employeeId, input.now),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `INSERT INTO system_identity_bindings
               (id, account_id, provider, subject, created_at, activated_at, revoked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`,
          )
          .bind(String(identityId), String(accountId), input.provider, subject.data, input.now),
        db
          .prepare(
            `INSERT INTO system_identity_profiles
               (identity_id, email, email_verified, last_used_at, updated_at)
             VALUES (?1, ?2, 1, NULL, ?3)`,
          )
          .bind(String(identityId), input.email, input.now),
        db
          .prepare(
            `INSERT INTO system_password_credentials
               (identity_id, password_hash, changed_at, created_at, updated_at)
             SELECT ?1, ?2, ?3, ?3, ?3
             WHERE ?4 = 'password' AND ?2 IS NOT NULL`,
          )
          .bind(String(identityId), input.secret, input.now, input.provider),
        db
          .prepare(
            `INSERT INTO system_role_bindings
               (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
             SELECT lower(hex(randomblob(16))), ?1, role.id, NULL, NULL, ?3, NULL
             FROM system_iam_roles role WHERE role.key = ?2`,
          )
          .bind(String(accountId), `company:${input.roleKey}`, input.now),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision account")
    }
  }

  async provisionExternalEmployee(input: ProvisionExternalEmployeeInput): Promise<number | Error> {
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!subject.success) return new Error("invalid identity subject", { cause: subject.error })
    const words = crypto.getRandomValues(new Uint32Array(4))
    const accountId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const identityId = ((words[2] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[3] ?? 0) || 1
    const db = this.c.env.DB

    try {
      const results = await db.batch([
        db
          .prepare("INSERT INTO employees (code, name, status) VALUES (NULL, ?1, 'active')")
          .bind(input.name),
        db
          .prepare(
            `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, ?2, ?2)`,
          )
          .bind(String(accountId), input.now),
        db
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             VALUES (?1, (SELECT id FROM employees WHERE code IS NULL ORDER BY id DESC LIMIT 1))`,
          )
          .bind(String(accountId)),
        db
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
          )
          .bind(String(accountId), input.name, input.now),
        db
          .prepare(
            `INSERT INTO system_identity_bindings
               (id, account_id, provider, subject, created_at, activated_at, revoked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`,
          )
          .bind(String(identityId), String(accountId), input.provider, subject.data, input.now),
        db
          .prepare(
            `INSERT INTO system_identity_profiles
               (identity_id, email, email_verified, last_used_at, updated_at)
             VALUES (?1, ?2, 1, NULL, ?3)`,
          )
          .bind(String(identityId), input.email, input.now),
        db
          .prepare(
            `INSERT INTO system_role_bindings
               (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
             SELECT lower(hex(randomblob(16))), ?1, role.id, NULL, NULL, ?3, NULL
             FROM system_iam_roles role WHERE role.key = ?2`,
          )
          .bind(String(accountId), `company:${input.roleKey}`, input.now),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      const employeeId = results[0]?.meta?.last_row_id
      return employeeId === undefined
        ? new Error("failed to retrieve employee id from batch")
        : employeeId
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to provision external employee")
    }
  }

  async attachExternalIdentity(input: AttachExternalIdentityInput): Promise<null | Error> {
    const subject = identitySubjectSchema.safeParse(input.subject)
    if (!subject.success) return new Error("invalid identity subject", { cause: subject.error })
    const words = crypto.getRandomValues(new Uint32Array(2))
    const identityId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const db = this.c.env.DB

    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO system_identity_bindings
               (id, account_id, provider, subject, created_at, activated_at, revoked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`,
          )
          .bind(
            String(identityId),
            String(input.accountId),
            input.provider,
            subject.data,
            input.now,
          ),
        db
          .prepare(
            `INSERT INTO system_identity_profiles
               (identity_id, email, email_verified, last_used_at, updated_at)
             VALUES (?1, ?2, 1, NULL, ?3)`,
          )
          .bind(String(identityId), input.email, input.now),
      ])
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to attach external identity")
    }
  }

  prepareProvisionByEmployeeCode(
    input: PreparedProvisionInput,
  ): ReadonlyArray<D1PreparedStatement> {
    const subject = identitySubjectSchema.parse(input.email.toLowerCase())
    const words = crypto.getRandomValues(new Uint32Array(4))
    const accountId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const identityId = ((words[2] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[3] ?? 0) || 1
    const db = this.c.env.DB

    return [
      db
        .prepare(
          `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
           SELECT ?2, 'active', 0, ?3, ?3 FROM employees WHERE code = ?1`,
        )
        .bind(input.employeeCode, String(accountId), input.now),
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(
          `INSERT INTO account_employee_links (account_id, employee_id)
           SELECT ?2, id FROM employees WHERE code = ?1`,
        )
        .bind(input.employeeCode, String(accountId)),
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(
          `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           SELECT 'organization:default', ?2, name, ?3, ?3
           FROM employees WHERE code = ?1`,
        )
        .bind(input.employeeCode, String(accountId), input.now),
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`,
        )
        .bind(String(identityId), String(accountId), subject, input.now),
      db
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES (?1, ?2, 1, NULL, ?3)`,
        )
        .bind(String(identityId), input.email, input.now),
      db
        .prepare(
          `INSERT INTO system_password_credentials
             (identity_id, password_hash, changed_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?3, ?3)`,
        )
        .bind(String(identityId), input.passwordHash, input.now),
      new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleByKey({
        actorAccountId: input.grantedByAccountId,
        targetRoleKey: input.roleKey,
        requiredPermissionKeys:
          input.roleKey === "member"
            ? ["employee:create", "employee:lifecycle:apply", "account:manage"]
            : [
                "employee:create",
                "employee:lifecycle:apply",
                "account:manage",
                "employee:assign_role",
              ],
      }),
      db
        .prepare(
          `INSERT INTO system_role_bindings
             (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
           SELECT lower(hex(randomblob(16))), ?1, role.id, NULL, NULL, ?3, NULL
           FROM system_iam_roles role WHERE role.key = ?2`,
        )
        .bind(String(accountId), `company:${input.roleKey}`, input.now),
      abortWhenPreviousStatementChangedNoRows(db),
    ]
  }

  async provisionWithEmployee(input: ProvisionWithEmployeeInput): Promise<number | Error> {
    const subject = identitySubjectSchema.safeParse(input.email.toLowerCase())
    if (!subject.success) return new Error("invalid identity subject", { cause: subject.error })
    const words = crypto.getRandomValues(new Uint32Array(4))
    const accountId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const identityId = ((words[2] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[3] ?? 0) || 1
    const db = this.c.env.DB

    try {
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO employees
               (code, name, dept_id, dept_name, position, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            input.employee.code,
            input.employee.name,
            input.employee.deptId,
            input.employee.deptName,
            input.employee.position,
            input.employee.status,
          ),
        db
          .prepare(
            `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, ?2, ?2)`,
          )
          .bind(String(accountId), input.now),
        db
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             SELECT ?2, id FROM employees WHERE code = ?1`,
          )
          .bind(input.employee.code, String(accountId)),
        db
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
          )
          .bind(String(accountId), input.employee.name, input.now),
        db
          .prepare(
            `INSERT INTO system_identity_bindings
               (id, account_id, provider, subject, created_at, activated_at, revoked_at)
             VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`,
          )
          .bind(String(identityId), String(accountId), subject.data, input.now),
        db
          .prepare(
            `INSERT INTO system_identity_profiles
               (identity_id, email, email_verified, last_used_at, updated_at)
             VALUES (?1, ?2, 1, NULL, ?3)`,
          )
          .bind(String(identityId), input.email, input.now),
        db
          .prepare(
            `INSERT INTO system_password_credentials
               (identity_id, password_hash, changed_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3, ?3)`,
          )
          .bind(String(identityId), input.passwordHash, input.now),
        new LivePermissionGuard(this.c).abortWhenActorCannotManageRoleByKey({
          actorAccountId: input.grantedByAccountId,
          targetRoleKey: input.roleKey,
          requiredPermissionKeys:
            input.roleKey === "member"
              ? ["employee:create"]
              : ["employee:create", "employee:assign_role"],
        }),
        db
          .prepare(
            `INSERT INTO system_role_bindings
               (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
             SELECT lower(hex(randomblob(16))), ?1, role.id, NULL, NULL, ?3, NULL
             FROM system_iam_roles role WHERE role.key = ?2`,
          )
          .bind(String(accountId), `company:${input.roleKey}`, input.now),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      const employeeId = results[0]?.meta?.last_row_id
      return employeeId === undefined
        ? new Error("failed to retrieve employee id from batch")
        : employeeId
    } catch (caught) {
      if (LivePermissionGuard.isAbortedBy(caught) || isAbortedByGuard(caught)) {
        return new RoleAssignmentGuardError({ cause: caught })
      }
      return caught instanceof Error
        ? caught
        : new Error("failed to provision employee with account")
    }
  }
}
