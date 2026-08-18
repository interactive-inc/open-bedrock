import type { AuditEventRecord } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { IdentitySubject } from "@/contexts/system/domain/identity/identity-subject"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"

export type BootstrapProps = {
  code: string
  name: string
  email: string
  subject: IdentitySubject
  secret: string
  now: number
  audit: AuditEventRecord
}

export type BootstrapCreated = { accountId: number; employeeId: number }
export type AlreadyInitialized = { reason: "already_initialized" }

/** canonical System rootと対応するCompany Employeeを一度だけ原子的に作成する。 */
export class BootstrapAccountRepository {
  constructor(private readonly c: Context) {}

  async createRootAccount(
    props: BootstrapProps,
  ): Promise<BootstrapCreated | AlreadyInitialized | Error> {
    const words = crypto.getRandomValues(new Uint32Array(4))
    const accountId = ((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1
    const identityId =
      ((words[2] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[3] ?? 0) || 1
    const bindingId = `bootstrap:${crypto.randomUUID()}`
    const database = this.c.env.DB

    try {
      await database.batch([
        database
          .prepare(
            `INSERT INTO employees (code, name, status)
             SELECT ?1, ?2, 'active'
             WHERE NOT EXISTS (SELECT 1 FROM system_bootstrap_state WHERE singleton = 1)`,
          )
          .bind(props.code, props.name),
        database
          .prepare(
            `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
             SELECT ?1, 'active', 0, ?2, ?2
             WHERE NOT EXISTS (SELECT 1 FROM system_bootstrap_state WHERE singleton = 1)`,
          )
          .bind(String(accountId), props.now),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             SELECT ?2, id FROM employees WHERE code = ?1`,
          )
          .bind(props.code, String(accountId)),
        database
          .prepare(
            `INSERT INTO system_identity_bindings
               (id, account_id, provider, subject, created_at, activated_at, revoked_at)
             VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`,
          )
          .bind(String(identityId), String(accountId), props.subject, props.now),
        database
          .prepare(
            `INSERT INTO system_identity_profiles
               (identity_id, email, email_verified, last_used_at, updated_at)
             VALUES (?1, ?2, 1, NULL, ?3)`,
          )
          .bind(String(identityId), props.email, props.now),
        database
          .prepare(
            `INSERT INTO system_password_credentials
               (identity_id, password_hash, changed_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3, ?3)`,
          )
          .bind(String(identityId), props.secret, props.now),
        database
          .prepare(
            `INSERT INTO system_role_bindings
               (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
             SELECT ?1, ?2, role.id, NULL, NULL, ?3, NULL
             FROM system_iam_roles role
             WHERE role.key = 'company:root' AND role.kind = 'managed'`,
          )
          .bind(bindingId, String(accountId), props.now),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `INSERT INTO system_bootstrap_state
               (singleton, completed_by_account_id, root_binding_id, completed_at)
             VALUES (1, ?1, ?2, ?3)`,
          )
          .bind(String(accountId), bindingId, props.now),
        ...new AuditEventRepository(this.c).prepareAppend(props.audit),
      ])
    } catch (caught) {
      if (isAbortedByGuard(caught)) return { reason: "already_initialized" }
      return caught instanceof Error ? caught : new Error("failed to bootstrap root account")
    }

    const employeeId = await database
      .prepare("SELECT employee_id FROM account_employee_links WHERE account_id = ?1")
      .bind(String(accountId))
      .first<number>("employee_id")
    return employeeId === null
      ? new Error("bootstrap succeeded but employee link is missing")
      : { accountId, employeeId }
  }
}
