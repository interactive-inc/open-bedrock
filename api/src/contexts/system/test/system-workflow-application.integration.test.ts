import { describe, expect, test } from "bun:test"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { DecideSystemTask } from "@system/application/workflow/decide-system-task"
import type { SystemTaskPersistence } from "@system/application/workflow/system-workflow-writer"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { zAccountId } from "@system/domain/auth/account-id"
import { DecisionTaskCandidate } from "@system/domain/workflow/decision-task-candidate.entity"
import { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import { proposalDigestSchema } from "@system/domain/workflow/system-case-reference"
import { createSystemD1TestDatabase } from "@system/infrastructure/auth/create-system-d1-test-database.test-support"
import { SystemD1WorkflowWriter } from "@system/infrastructure/workflow/system-d1-workflow-writer"
import { readFileSync } from "node:fs"

const schema = [
  readFileSync(new URL("../infrastructure/schema/system-core.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../infrastructure/schema/system-workflow.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../infrastructure/schema/system-procedure.sql", import.meta.url), "utf8"),
].join("\n")
const evidenceDigest = proposalDigestSchema.parse("b".repeat(64))

async function createFixture(): Promise<{
  database: D1Database
  writer: SystemD1WorkflowWriter
}> {
  const database = createSystemD1TestDatabase(schema)
  for (const accountId of ["creator", "reviewer-1", "reviewer-2", "final-reviewer", "inactive"]) {
    await database
      .prepare(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, ?2, 0, 100, 100)`,
      )
      .bind(accountId, accountId === "inactive" ? "suspended" : "active")
      .run()
  }
  await database
    .prepare(
      `INSERT INTO system_procedure_definitions
         (key, current_revision, status, created_at, updated_at)
       VALUES ('change', 1, 'active', 100, 100)`,
    )
    .run()
  await database
    .prepare(
      `INSERT INTO system_procedure_definition_revisions
         (procedure_key, revision, title, category, input_schema_json,
          decision_policy_json, created_by_account_id, created_at)
       VALUES ('change', 1, 'Change', 'operation', '{}', '{}', 'creator', 100)`,
    )
    .run()

  return {
    database,
    writer: new SystemD1WorkflowWriter({ env: { DB: database } }),
  }
}

function candidate(
  accountId: string,
  at: Date,
): {
  accountId: ReturnType<typeof zAccountId.parse>
  source: "primary"
  evidenceContext: string
  evidenceKind: string
  evidenceId: string
  evidenceVersion: string
  eligibilityDigest: typeof evidenceDigest
  eligibleFrom: null
  resolvedAt: Date
} {
  return {
    accountId: zAccountId.parse(accountId),
    source: "primary",
    evidenceContext: "authority",
    evidenceKind: "qualification",
    evidenceId: `evidence-${accountId}`,
    evidenceVersion: "1",
    eligibilityDigest: evidenceDigest,
    eligibleFrom: null,
    resolvedAt: at,
  }
}

function nextTask(
  caseId: Parameters<typeof DecisionTask.create>[0] extends infer _Unused ? string : never,
  proposalDigest: typeof evidenceDigest,
  at: Date,
): SystemTaskPersistence {
  const finalCandidate = DecisionTaskCandidate.create(candidate("final-reviewer", at))
  if (finalCandidate instanceof InvalidSystemWorkflowError) throw finalCandidate
  const task = DecisionTask.create({
    caseId,
    key: "final-review",
    round: 1,
    candidateAccountIds: [finalCandidate.accountId],
    excludedAccountIds: [zAccountId.parse("creator")],
    requiredApprovals: 1,
    proposalDigest,
    openedAt: at,
    dueAt: null,
  })
  if (task instanceof InvalidSystemWorkflowError) throw task

  return {
    task,
    candidates: [finalCandidate],
    exclusions: [{ accountId: zAccountId.parse("creator"), reason: "creator" }],
  }
}

describe("System workflow application", () => {
  test("提案、Case、Taskを同時作成し、quorumと次TaskをSystemだけで進める", async () => {
    const fixture = await createFixture()
    const at = new Date(200)
    const started = await new StartSystemProcedure(fixture.writer).run({
      seriesId: "series-1",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: { reason: "safe", amount: 10 },
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: null,
      createdAt: at,
      firstTask: {
        key: "review",
        requiredApprovals: 2,
        openedAt: at,
        dueAt: null,
        candidates: [candidate("reviewer-1", at), candidate("reviewer-2", at)],
        excludedAccountIds: [],
      },
    })

    expect(started).not.toBeInstanceOf(Error)
    if (started instanceof Error) return
    expect(started.number).toBe(1)
    const next = nextTask(started.workflowCase.id, started.proposal.digest, new Date(220))
    const first = await new DecideSystemTask(fixture.writer).run({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-1"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: null,
      action: "approve",
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: new Date(210),
      nextTask: next,
    })

    expect(first).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    expect(
      await fixture.database
        .prepare(
          "SELECT count(*) AS count FROM system_decision_tasks WHERE task_key = 'final-review'",
        )
        .first<number>("count"),
    ).toBe(0)

    const second = await new DecideSystemTask(fixture.writer).run({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-2"),
      representedAccountId: zAccountId.parse("reviewer-2"),
      delegationId: null,
      action: "approve",
      proposalDigest: started.proposal.digest,
      comment: "reviewed",
      decidedAt: new Date(220),
      nextTask: next,
    })

    expect(second).toEqual({ caseStatus: "pending", taskOutcome: "approved" })
    expect(
      await fixture.database
        .prepare(
          "SELECT count(*) AS count FROM system_decision_tasks WHERE task_key = 'final-review'",
        )
        .first<number>("count"),
    ).toBe(1)

    const final = await new DecideSystemTask(fixture.writer).run({
      caseId: started.workflowCase.id,
      taskKey: "final-review",
      round: 1,
      actorAccountId: zAccountId.parse("final-reviewer"),
      representedAccountId: zAccountId.parse("final-reviewer"),
      delegationId: null,
      action: "approve",
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: new Date(230),
      nextTask: null,
    })

    expect(final).toEqual({ caseStatus: "approved", taskOutcome: "approved" })
    expect(
      await fixture.database.prepare("SELECT status FROM system_cases").first<string>("status"),
    ).toBe("approved")
  })

  test("停止Accountの候補と判断を原子的に拒否する", async () => {
    const fixture = await createFixture()
    const at = new Date(200)
    const invalidStart = await new StartSystemProcedure(fixture.writer).run({
      seriesId: "series-inactive",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: {},
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: null,
      createdAt: at,
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: at,
        dueAt: null,
        candidates: [candidate("inactive", at)],
        excludedAccountIds: [],
      },
    })

    expect(invalidStart).toBeInstanceOf(Error)
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS count FROM system_proposals")
        .first<number>("count"),
    ).toBe(0)
  })

  test("修正再提出は旧Caseを閉じ、同じ公開番号の新しい提案版を作る", async () => {
    const fixture = await createFixture()
    const start = new StartSystemProcedure(fixture.writer)
    const first = await start.run({
      seriesId: "series-revision",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: { amount: 10 },
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: null,
      createdAt: new Date(200),
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: new Date(200),
        dueAt: null,
        candidates: [candidate("reviewer-1", new Date(200))],
        excludedAccountIds: [],
      },
    })
    if (first instanceof Error) throw first

    const second = await start.run({
      seriesId: first.proposal.seriesId,
      version: 2,
      procedureKey: "change",
      procedureRevision: 1,
      body: { amount: 20 },
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: first.proposal.id,
      createdAt: new Date(220),
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: new Date(220),
        dueAt: null,
        candidates: [candidate("reviewer-2", new Date(220))],
        excludedAccountIds: [],
      },
    })
    if (second instanceof Error) throw second

    expect(second.number).toBe(first.number)
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_cases WHERE id = ?1")
        .bind(first.workflowCase.id)
        .first<string>("status"),
    ).toBe("cancelled")
    expect(
      await fixture.database
        .prepare("SELECT count(*) FROM system_proposal_numbers")
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("取下げは提案を削除せず未完了TaskとCaseを閉じる", async () => {
    const fixture = await createFixture()
    const started = await new StartSystemProcedure(fixture.writer).run({
      seriesId: "series-cancel",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: {},
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: null,
      createdAt: new Date(200),
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: new Date(200),
        dueAt: null,
        candidates: [candidate("reviewer-1", new Date(200))],
        excludedAccountIds: [],
      },
    })
    if (started instanceof Error) throw started

    expect(
      await new CancelSystemProcedure(fixture.writer).run({
        number: started.number,
        createdByAccountId: zAccountId.parse("creator"),
        cancelledAt: new Date(210),
      }),
    ).toBe(true)
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_cases WHERE id = ?1")
        .bind(started.workflowCase.id)
        .first<string>("status"),
    ).toBe("cancelled")
    expect(
      await fixture.database
        .prepare("SELECT count(*) FROM system_proposals")
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("否定判断を証拠と同時に確定し、後続Taskを開かない", async () => {
    const fixture = await createFixture()
    const at = new Date(200)
    const started = await new StartSystemProcedure(fixture.writer).run({
      seriesId: "series-reject",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: {},
      createdByAccountId: zAccountId.parse("creator"),
      supersedesProposalId: null,
      createdAt: at,
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: at,
        dueAt: null,
        candidates: [candidate("reviewer-1", at)],
        excludedAccountIds: [],
      },
    })
    if (started instanceof Error) throw started

    const rejected = await new DecideSystemTask(fixture.writer).run({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-1"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: null,
      action: "reject",
      proposalDigest: started.proposal.digest,
      comment: "unsafe",
      decidedAt: new Date(210),
      nextTask: null,
    })

    expect(rejected).toEqual({
      caseStatus: "rejected",
      taskOutcome: "rejected",
    })
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS count FROM system_human_attestations")
        .first<number>("count"),
    ).toBe(1)
  })
})
