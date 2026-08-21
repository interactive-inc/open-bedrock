import { systemWorkflowSchema } from "@system/infrastructure/schema/system-workflow"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"

const coreSchemaSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const workflowSchemaSql = readFileSync(new URL("./system-workflow.sql", import.meta.url), "utf8")
const digest = "a".repeat(64)
const evidenceDigest = "b".repeat(64)

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSchemaSql)
  database.exec(workflowSchemaSql)

  return database
}

function insertAccount(database: Database, id: string): void {
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES (?, 'active', 0, 100, 100)`,
    [id],
  )
}

function insertCase(database: Database, id: string = "case-1"): void {
  database.run(
    `INSERT INTO system_cases
       (id, subject_context, subject_kind, subject_id, subject_version,
        proposal_digest, created_by_account_id, status, created_at, updated_at)
     VALUES (?, 'request', 'change', 'resource-1', '1', ?, 'creator', 'pending', 100, 100)`,
    [id, digest],
  )
}

function insertTask(
  database: Database,
  props: Readonly<{ caseId?: string; taskKey?: string; requiredApprovals?: number }> = {},
): void {
  database.run(
    `INSERT INTO system_decision_tasks
       (case_id, task_key, round, required_approvals, proposal_digest, opened_at)
     VALUES (?, ?, 1, ?, ?, 100)`,
    [props.caseId ?? "case-1", props.taskKey ?? "review", props.requiredApprovals ?? 1, digest],
  )
}

function insertCandidate(
  database: Database,
  props: Readonly<{
    accountId: string
    caseId?: string
    taskKey?: string
    source?: "primary" | "escalation"
    eligibleFrom?: number | null
  }>,
): void {
  database.run(
    `INSERT INTO system_decision_task_candidates
       (case_id, task_key, round, candidate_account_id, source,
        evidence_context, evidence_kind, evidence_id, evidence_version,
        eligibility_digest, eligible_from, resolved_at)
     VALUES (?, ?, 1, ?, ?, 'authority', 'qualification', ?, '1', ?, ?, 100)`,
    [
      props.caseId ?? "case-1",
      props.taskKey ?? "review",
      props.accountId,
      props.source ?? "primary",
      `evidence-${props.accountId}`,
      evidenceDigest,
      props.eligibleFrom ?? null,
    ],
  )
}

function insertAttestation(
  database: Database,
  props: Readonly<{
    id: string
    actorAccountId: string
    representedAccountId?: string
    delegationId?: string | null
    action?: "approve" | "reject" | "return"
    decidedAt?: number
    caseId?: string
    taskKey?: string
  }>,
): void {
  database.run(
    `INSERT INTO system_human_attestations
       (id, case_id, task_key, round, actor_account_id, represented_account_id,
        delegation_id, action, proposal_digest, comment, decided_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      props.id,
      props.caseId ?? "case-1",
      props.taskKey ?? "review",
      props.actorAccountId,
      props.representedAccountId ?? props.actorAccountId,
      props.delegationId ?? null,
      props.action ?? "approve",
      digest,
      props.decidedAt ?? 110,
    ],
  )
}

describe("System workflow schema", () => {
  test("released migrationをcanonical DDLと完全一致させる", () => {
    const releasedMigrationSql = readReleasedSystemMigration("system_workflow")

    expect(releasedMigrationSql).toBe(workflowSchemaSql)
  })

  test("Drizzle宣言とDDLのtable・column・indexを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemWorkflowSchema)
      .map((table) => getTableConfig(table))
      .toSorted((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map((table) => table.name)).toEqual([
      "system_cases",
      "system_decision_task_candidates",
      "system_decision_task_exclusions",
      "system_decision_tasks",
      "system_delegations",
      "system_execution_authorizations",
      "system_human_attestations",
    ])

    const liveIndexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map((index) => index.name),
    )

    for (const table of declaredTables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
      const foreignTables = database
        .query<{ table: string }, []>(`PRAGMA foreign_key_list(${table.name})`)
        .all()
        .map((foreignKey) => foreignKey.table)

      expect(columns).toEqual(table.columns.map((column) => column.name))
      expect(foreignTables.every((foreignTable) => foreignTable.startsWith("system_"))).toBe(true)
      expect(
        table.indexes
          .map((index) => index.config.name)
          .filter((name): name is string => typeof name === "string" && !liveIndexes.has(name)),
      ).toEqual([])
    }

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("自己判断とquorum未達を拒否し、十分なappend-only証明だけで承認する", () => {
    const database = createDatabase()
    for (const accountId of ["creator", "approver-1", "approver-2"]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, { requiredApprovals: 2 })
    database.run(
      `INSERT INTO system_decision_task_exclusions
         (case_id, task_key, round, excluded_account_id, reason)
       VALUES ('case-1', 'review', 1, 'creator', 'creator')`,
    )

    expect(() => insertCandidate(database, { accountId: "creator" })).toThrow()
    insertCandidate(database, { accountId: "approver-1" })
    insertCandidate(database, { accountId: "approver-2" })
    expect(() =>
      insertAttestation(database, { id: "creator-decision", actorAccountId: "creator" }),
    ).toThrow()

    insertAttestation(database, { id: "decision-1", actorAccountId: "approver-1" })
    expect(() =>
      database.run(
        `UPDATE system_decision_tasks
         SET outcome = 'approved', closed_at = 120
         WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
      ),
    ).toThrow()
    insertAttestation(database, { id: "decision-2", actorAccountId: "approver-2" })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'approved', closed_at = 120
       WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'approved', updated_at = 120 WHERE id = 'case-1'",
    )

    expect(() =>
      database.run(
        "UPDATE system_human_attestations SET comment = 'changed' WHERE id = 'decision-1'",
      ),
    ).toThrow()
    expect(() =>
      database.run("DELETE FROM system_human_attestations WHERE id = 'decision-1'"),
    ).toThrow()
    expect(database.query("SELECT status FROM system_cases WHERE id = 'case-1'").get()).toEqual({
      status: "approved",
    })
    database.close()
  })

  test("時点と対象scopeが一致する委任だけを人間の判断証明として受理する", () => {
    const database = createDatabase()
    for (const accountId of ["creator", "represented", "delegate"]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, { accountId: "represented" })
    database.run(
      `INSERT INTO system_delegations
         (id, delegator_account_id, delegate_account_id, scope_context, scope_kind,
          scope_id, scope_version, starts_at, ends_at, created_at)
       VALUES
         ('wrong-scope', 'represented', 'delegate', 'request', 'change',
          'other-resource', '1', 100, 200, 100),
         ('valid-scope', 'represented', 'delegate', 'request', 'change',
          'resource-1', '1', 100, 200, 100)`,
    )

    expect(() =>
      insertAttestation(database, {
        id: "wrong",
        actorAccountId: "delegate",
        representedAccountId: "represented",
        delegationId: "wrong-scope",
      }),
    ).toThrow()
    insertAttestation(database, {
      id: "delegated-decision",
      actorAccountId: "delegate",
      representedAccountId: "represented",
      delegationId: "valid-scope",
    })
    expect(() =>
      database.run("UPDATE system_delegations SET revoked_at = 150 WHERE id = 'valid-scope'"),
    ).not.toThrow()
    expect(() =>
      database.run("UPDATE system_delegations SET revoked_at = 160 WHERE id = 'valid-scope'"),
    ).toThrow()
    database.close()
  })

  test("escalation開始前の判断、証拠のない差戻し、未承認実行を拒否する", () => {
    const database = createDatabase()
    for (const accountId of ["creator", "approver", "executor"]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, {
      accountId: "approver",
      source: "escalation",
      eligibleFrom: 150,
    })

    expect(() =>
      insertAttestation(database, {
        id: "too-early",
        actorAccountId: "approver",
        decidedAt: 149,
      }),
    ).toThrow()
    expect(() =>
      database.run(
        `UPDATE system_decision_tasks
         SET outcome = 'returned', closed_at = 150
         WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_execution_authorizations
           (id, case_id, operation_key, proposal_digest, granted_to_account_id,
            granted_at, expires_at)
         VALUES ('authorization-1', 'case-1', 'execute', ?, 'executor', 150, 200)`,
        [digest],
      ),
    ).toThrow()

    insertAttestation(database, {
      id: "return-decision",
      actorAccountId: "approver",
      action: "return",
      decidedAt: 150,
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'returned', closed_at = 150
       WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'returned', updated_at = 150 WHERE id = 'case-1'",
    )
    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'approved', updated_at = 151 WHERE id = 'case-1'",
      ),
    ).toThrow()
    database.close()
  })

  test("複数Taskの否定判断ではCase全体のrejectをreturnより優先する", () => {
    const database = createDatabase()
    for (const accountId of ["creator", "rejector", "returner"]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, { taskKey: "risk-review" })
    insertTask(database, { taskKey: "content-review" })
    insertCandidate(database, { accountId: "rejector", taskKey: "risk-review" })
    insertCandidate(database, { accountId: "returner", taskKey: "content-review" })
    insertAttestation(database, {
      id: "rejection",
      actorAccountId: "rejector",
      taskKey: "risk-review",
      action: "reject",
    })
    insertAttestation(database, {
      id: "return",
      actorAccountId: "returner",
      taskKey: "content-review",
      action: "return",
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'rejected', closed_at = 120
       WHERE case_id = 'case-1' AND task_key = 'risk-review' AND round = 1`,
    )
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'returned', closed_at = 120
       WHERE case_id = 'case-1' AND task_key = 'content-review' AND round = 1`,
    )

    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'returned', updated_at = 120 WHERE id = 'case-1'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_cases SET status = 'rejected', updated_at = 120 WHERE id = 'case-1'",
    )

    expect(database.query("SELECT status FROM system_cases WHERE id = 'case-1'").get()).toEqual({
      status: "rejected",
    })
    database.close()
  })

  test("取消時にopen taskを残さず、再割当roundを取消済みroundの次だけに限定する", () => {
    const database = createDatabase()
    insertAccount(database, "creator")
    insertCase(database)
    insertTask(database)

    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'cancelled', updated_at = 110 WHERE id = 'case-1'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_decision_tasks
           (case_id, task_key, round, required_approvals, proposal_digest, opened_at)
         VALUES ('case-1', 'review', 2, 1, ?, 110)`,
        [digest],
      ),
    ).toThrow()

    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'cancelled', closed_at = 110
       WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      `INSERT INTO system_decision_tasks
         (case_id, task_key, round, required_approvals, proposal_digest, opened_at)
       VALUES ('case-1', 'review', 2, 1, ?, 110)`,
      [digest],
    )
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'cancelled', closed_at = 120
       WHERE case_id = 'case-1' AND task_key = 'review' AND round = 2`,
    )
    database.run(
      "UPDATE system_cases SET status = 'cancelled', updated_at = 120 WHERE id = 'case-1'",
    )

    expect(database.query("SELECT status FROM system_cases WHERE id = 'case-1'").get()).toEqual({
      status: "cancelled",
    })
    database.close()
  })

  test("承認digestへ発行した実行許可を期限内に一度だけ消費して実行済みにする", () => {
    const database = createDatabase()
    for (const accountId of ["creator", "approver", "executor"]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, { accountId: "approver" })
    insertAttestation(database, { id: "decision", actorAccountId: "approver" })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'approved', closed_at = 120
       WHERE case_id = 'case-1' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'approved', updated_at = 120 WHERE id = 'case-1'",
    )
    database.run(
      `INSERT INTO system_execution_authorizations
         (id, case_id, operation_key, proposal_digest, granted_to_account_id,
          granted_at, expires_at)
       VALUES ('authorization-1', 'case-1', 'execute', ?, 'executor', 120, 200)`,
      [digest],
    )

    expect(() =>
      database.run(
        "UPDATE system_execution_authorizations SET used_at = 200 WHERE id = 'authorization-1'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'executed', updated_at = 130 WHERE id = 'case-1'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_execution_authorizations SET used_at = 130 WHERE id = 'authorization-1'",
    )
    expect(() =>
      database.run(
        "UPDATE system_execution_authorizations SET used_at = 140 WHERE id = 'authorization-1'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_cases SET status = 'executed', updated_at = 130 WHERE id = 'case-1'",
    )

    expect(database.query("SELECT status FROM system_cases WHERE id = 'case-1'").get()).toEqual({
      status: "executed",
    })
    database.close()
  })
})
