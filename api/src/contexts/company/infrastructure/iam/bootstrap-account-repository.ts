import type { AuditEventRecord } from "@/contexts/company/application/audit/company-audit-event"
import type { IdentitySubject } from "@/contexts/system/domain/identity/identity-subject"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
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

export type BootstrapCreated = {
  accountId: number
  employeeId: number
}

export type AlreadyInitialized = { reason: "already_initialized" }

/**
 * 初期 ROOT アカウントを 1 度だけ生成する。accounts が空のときにのみ成立する。
 * employees→accounts→account_employee_links→identities→account_roles→audit を 1 バッチで原子的に書き込む。
 * accounts への条件付き INSERT が 0 行なら（= 既に初期化済み）バッチごと rollback して
 * AlreadyInitialized を返す。id はバッチ後に employee code を鍵に読み戻す
 * （last_insert_rowid は挿入ごとにずれるため使わない）。
 */
export class BootstrapAccountRepository {
  constructor(private readonly c: Context) {}

  async createRootAccount(
    props: BootstrapProps,
  ): Promise<BootstrapCreated | AlreadyInitialized | Error> {
    const database = this.c.env.DB

    const auditStatements = new AuditEventRepository(this.c).prepareAppend(props.audit)

    try {
      await database.batch([
        database
          .prepare(
            `INSERT INTO employees (code, name, status)
             SELECT ?1, ?2, 'active'
             WHERE NOT EXISTS (SELECT 1 FROM accounts)`,
          )
          .bind(props.code, props.name),
        database
          .prepare(
            `INSERT INTO accounts (status, token_version, created_at, updated_at)
             SELECT 'active', 0, ?2, ?2
             FROM employees e
             WHERE e.code = ?1 AND NOT EXISTS (SELECT 1 FROM accounts)`,
          )
          .bind(props.code, props.now),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             SELECT a.id, e.id
             FROM accounts a, employees e
             WHERE e.code = ?1`,
          )
          .bind(props.code),
        database
          .prepare(
            `INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
             SELECT a.id, 'password', ?2, ?3, ?4, 1, ?5
             FROM accounts a
             JOIN account_employee_links link ON link.account_id = a.id
             JOIN employees e ON e.id = link.employee_id
             WHERE e.code = ?1`,
          )
          .bind(props.code, props.subject, props.secret, props.email, props.now),
        database
          .prepare(
            `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
             SELECT a.id, r.id, NULL, ?2
             FROM accounts a
             JOIN account_employee_links link ON link.account_id = a.id
             JOIN employees e ON e.id = link.employee_id
             JOIN roles r ON r.key = 'root' AND r.is_system = 1
             WHERE e.code = ?1`,
          )
          .bind(props.code, props.now),
        ...auditStatements,
      ])
    } catch (caught) {
      if (isAbortedByGuard(caught)) {
        return { reason: "already_initialized" }
      }

      return caught instanceof Error ? caught : new Error("failed to bootstrap root account")
    }

    const created = await database
      .prepare(
        `SELECT account.id, link.employee_id
         FROM accounts account
         JOIN account_employee_links link ON link.account_id = account.id
         LIMIT 1`,
      )
      .first<{ id: number; employee_id: number }>()

    if (created === null) {
      return new Error("bootstrap succeeded but account row is missing")
    }

    return { accountId: created.id, employeeId: created.employee_id }
  }
}
