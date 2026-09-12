import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { describe, expect, test } from "bun:test"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { DecisionTaskCandidateEntity } from "@system/domain/entities/decision-task-candidate.entity"
import { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { proposalIdSchema } from "@system/domain/schemas/workflow/proposal-id.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { RevalidateSystemExecutionAttestationsAdapter } from "@system/infrastructure/adapters/workflow/revalidate-system-execution-attestations.adapter"
import { readFileSync } from "node:fs"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"

const schema = [
  readFileSync(new URL("../infrastructure/schema/system-principal.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../infrastructure/schema/system-core.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../infrastructure/schema/system-workflow.sql", import.meta.url), "utf8"),
  readFileSync(
    new URL("../infrastructure/schema/system-decision-policy.sql", import.meta.url),
    "utf8",
  ),
  readFileSync(new URL("../infrastructure/schema/system-procedure.sql", import.meta.url), "utf8"),
  readFileSync(
    new URL("../infrastructure/schema/system-procedure-delegation.sql", import.meta.url),
    "utf8",
  ),
].join("\n")
const evidenceDigest = proposalDigestSchema.parse("b".repeat(64))

async function createFixture(): Promise<{
  database: D1Database
  writer: SystemD1WorkflowAdapter
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
    await database
      .prepare(`INSERT INTO system_principals
      (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES (?1, ?2, 'human', ?2, NULL, 1, 100, 100)`)
      .bind(`principal:${accountId}`, accountId)
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
    writer: new SystemD1WorkflowAdapter({ env: { DB: database } }),
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
  caseId: Parameters<typeof DecisionTaskEntity.create>[0] extends infer _Unused ? string : never,
  proposalDigest: typeof evidenceDigest,
  at: Date,
): SystemDecisionTaskBundle {
  const finalCandidate = DecisionTaskCandidateEntity.create(candidate("final-reviewer", at))
  if (finalCandidate instanceof InvalidSystemWorkflowError) throw finalCandidate
  const task = DecisionTaskEntity.create({
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
  test.each(["canonical", "released"])(
    "DBも候補・本人判断・代理判断のPrincipalを必須にする: %s",
    async (source) => {
      const guards =
        source === "canonical"
          ? readFileSync(
              new URL("../infrastructure/schema/system-human-decision.sql", import.meta.url),
              "utf8",
            )
          : ["require_system_human_decision_candidates", "require_system_human_attestations"]
              .map(readReleasedSystemMigration)
              .join("\n")
      for (const phase of ["candidate", "actor", "represented"]) {
        for (const kind of ["valid", "missing", "future", "machine"]) {
          const fixture = await createFixture()
          await fixture.database.exec(guards)
          const at = new Date(200)
          const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
            seriesId: "direct-human-check",
            version: 1,
            procedureKey: "change",
            procedureRevision: 1,
            body: { reason: "Direct persistence boundary" },
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
          if (phase === "represented")
            await fixture.database.exec(`INSERT INTO system_delegations
          (id, delegator_account_id, delegate_account_id, starts_at, ends_at, created_at)
          VALUES ('direct-delegation', 'reviewer-1', 'reviewer-2', 100, 300, 100)`)
          const accountId = phase === "candidate" ? "reviewer-2" : "reviewer-1"
          if (kind === "missing")
            await fixture.database
              .prepare("DELETE FROM system_principals WHERE account_id = ?1")
              .bind(accountId)
              .run()
          if (kind === "machine")
            await fixture.database
              .prepare(
                "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = ?1",
              )
              .bind(accountId)
              .run()
          if (kind === "future")
            await fixture.database
              .prepare(
                "UPDATE system_principals SET created_at = 220, updated_at = 220, revision = revision + 1 WHERE account_id = ?1",
              )
              .bind(accountId)
              .run()
          const operation =
            phase === "candidate"
              ? fixture.database
                  .prepare(`INSERT INTO system_decision_task_candidates
          (case_id, task_key, round, candidate_account_id, source, evidence_context, evidence_kind, evidence_id, evidence_version, eligibility_digest, eligible_from, resolved_at)
          VALUES (?1, 'review', 1, 'reviewer-2', 'primary', 'authority', 'qualification', 'evidence:2', '1', ?2, NULL, 200)`)
                  .bind(started.workflowCase.id, evidenceDigest)
              : fixture.database
                  .prepare(`INSERT INTO system_human_attestations
          (id, case_id, task_key, round, actor_account_id, represented_account_id, delegation_id, action, proposal_digest, comment, decided_at)
          VALUES ('direct-attestation', ?1, 'review', 1, ?2, 'reviewer-1', ?3, 'approve', ?4, NULL, 210)`)
                  .bind(
                    started.workflowCase.id,
                    phase === "represented" ? "reviewer-2" : "reviewer-1",
                    phase === "represented" ? "direct-delegation" : null,
                    started.proposal.digest,
                  )
          const result = await operation.run().then(
            () => null,
            (cause: unknown) => cause,
          )
          if (kind === "valid") expect(result).toBeNull()
          else {
            expect(result).toBeInstanceOf(Error)
            if (!(result instanceof Error)) throw new Error("expected human decision rejection")
            expect(result.message).toContain(
              phase === "candidate"
                ? "system_decision_candidate_requires_human"
                : "system_attestation_requires_human",
            )
          }
        }
      }
    },
  )
  test.each([
    "delegation",
    "account",
    "principal",
    "missing_actor",
    "missing_represented",
    "recreated_actor",
  ])("実行時の証言再検査は失効と確認後の競合を検出する: %s", async (change) => {
    const fixture = await createFixture()
    const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
      seriesId: "execution-series",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: { reason: "Execution evidence" },
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
    await fixture.database
      .prepare(`INSERT INTO system_delegations
        (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id, scope_version,
         starts_at, ends_at, created_at, revoked_at)
        VALUES ('execution-delegation', 'reviewer-1', 'reviewer-2', NULL, NULL, NULL, NULL, 100, 500, 100, NULL)`)
      .run()
    const approved = await new ApproveSystemTask(fixture.writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-2"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: "execution-delegation",
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: new Date(210),
      nextTask: null,
    })
    expect(approved).toEqual({ caseStatus: "approved", taskOutcome: "approved" })
    const validator = new RevalidateSystemExecutionAttestationsAdapter({
      env: { DB: fixture.database },
    })
    const input = { caseId: started.workflowCase.id, executedAt: new Date(300) }
    const before = await validator.prepare(input)
    if (before instanceof Error) throw before
    expect(before.attestations).toHaveLength(1)
    expect(before.tasks[0]?.outcome).toBe("approved")
    await fixture.database.batch([before.guard])
    const expired = await validator.prepare({ ...input, executedAt: new Date(500) })
    if (expired instanceof Error) throw expired
    expect(expired.attestations).toHaveLength(0)
    if (change === "delegation") {
      await fixture.database.exec(
        "UPDATE system_delegations SET revoked_at = 250 WHERE id = 'execution-delegation'",
      )
      await fixture.database.exec(`INSERT INTO system_delegations
          (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id, scope_version,
           starts_at, ends_at, created_at, revoked_at)
          VALUES ('replacement-delegation', 'reviewer-1', 'reviewer-2', NULL, NULL, NULL, NULL, 260, 500, 260, NULL)`)
    } else if (change === "account") {
      await fixture.database.exec(
        "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = 'reviewer-1'",
      )
    } else if (change === "principal") {
      await fixture.database.exec(
        "UPDATE system_principals SET kind = 'agent', revision = revision + 1, updated_at = 250 WHERE account_id = 'reviewer-2'",
      )
    } else {
      const account = change === "missing_represented" ? "reviewer-1" : "reviewer-2"
      await fixture.database
        .prepare("DELETE FROM system_principals WHERE account_id = ?1")
        .bind(account)
        .run()
      if (change === "recreated_actor")
        await fixture.database.exec(`INSERT INTO system_principals
          (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
          VALUES ('replacement-human', 'reviewer-2', 'human', 'Replacement', NULL, 1, 250, 250)`)
    }
    const conflict = await fixture.database.batch([before.guard]).then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(conflict).toBeInstanceOf(Error)
    const after = await validator.prepare(input)
    if (after instanceof Error) throw after
    expect(after.attestations).toHaveLength(0)
  })

  test.each(
    ["candidate", "attestation"].flatMap((phase) =>
      ["machine", "missing", "future"].map((kind) => [phase, kind] as const),
    ),
  )("人と確認できないPrincipalは候補・証言に使えない: %s %s", async (phase, kind) => {
    const fixture = await createFixture()
    const machine = () =>
      fixture.database
        .prepare(
          kind === "missing"
            ? "DELETE FROM system_principals WHERE account_id = 'reviewer-1'"
            : kind === "future"
              ? "UPDATE system_principals SET created_at = 220, updated_at = 220, revision = revision + 1 WHERE account_id = 'reviewer-1'"
              : "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = 'reviewer-1'",
        )
        .run()
    if (phase === "candidate") await machine()
    const at = new Date(200)
    const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
      seriesId: "machine-series",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: { reason: "Human decision required" },
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
    if (phase === "candidate") {
      expect(started).toBeInstanceOf(Error)
      expect(
        await fixture.database
          .prepare("SELECT count(*) AS total FROM system_proposals")
          .first<number>("total"),
      ).toBe(0)
      return
    }
    if (started instanceof Error) throw started
    await machine()
    expect(
      await new ApproveSystemTask(fixture.writer).execute({
        caseId: started.workflowCase.id,
        taskKey: "review",
        round: 1,
        actorAccountId: zAccountId.parse("reviewer-1"),
        representedAccountId: zAccountId.parse("reviewer-1"),
        delegationId: null,
        proposalDigest: started.proposal.digest,
        comment: null,
        decidedAt: new Date(210),
        nextTask: null,
      }),
    ).toBeInstanceOf(Error)
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
  })

  test.each(["missing", "future", "machine"])(
    "次段階の候補が人と確認できなければ、現在段階の承認も確定しない: %s",
    async (kind) => {
      const fixture = await createFixture()
      const at = new Date(200)
      const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
        seriesId: "next-human-review",
        version: 1,
        procedureKey: "change",
        procedureRevision: 1,
        body: { reason: "Two human decisions" },
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
      if (kind === "missing")
        await fixture.database.exec(
          "DELETE FROM system_principals WHERE account_id = 'final-reviewer'",
        )
      if (kind === "machine")
        await fixture.database.exec(
          "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = 'final-reviewer'",
        )
      if (kind === "future")
        await fixture.database.exec(
          "UPDATE system_principals SET created_at = 220, updated_at = 220, revision = revision + 1 WHERE account_id = 'final-reviewer'",
        )
      const result = await new ApproveSystemTask(fixture.writer).execute({
        caseId: started.workflowCase.id,
        taskKey: "review",
        round: 1,
        actorAccountId: zAccountId.parse("reviewer-1"),
        representedAccountId: zAccountId.parse("reviewer-1"),
        delegationId: null,
        proposalDigest: started.proposal.digest,
        comment: null,
        decidedAt: new Date(210),
        nextTask: nextTask(started.workflowCase.id, started.proposal.digest, new Date(210)),
      })
      expect(result).toBeInstanceOf(Error)
      expect(
        await fixture.database
          .prepare("SELECT count(*) AS total FROM system_human_attestations")
          .first<number>("total"),
      ).toBe(0)
      expect(
        await fixture.database
          .prepare(
            "SELECT outcome FROM system_decision_tasks WHERE case_id = ?1 AND task_key = 'review'",
          )
          .bind(started.workflowCase.id)
          .first<string | null>("outcome"),
      ).toBeNull()
    },
  )

  test("上位contextの判断guardが拒否するとTaskと証言を保存しない", async () => {
    const fixture = await createFixture()
    const at = new Date(200)
    const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
      seriesId: "guarded-series",
      version: 1,
      procedureKey: "change",
      procedureRevision: 1,
      body: { reason: "Guarded decision" },
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
    const guardedWriter = new SystemD1WorkflowAdapter({
      env: { DB: fixture.database },
      decisionGuards: [fixture.database.prepare("SELECT json_extract('', '$')")],
    })
    const command = {
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-1"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: null,
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: new Date(210),
      nextTask: null,
    }
    expect(await new ApproveSystemTask(guardedWriter).execute(command)).toBeInstanceOf(Error)
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS total FROM system_human_attestations")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await fixture.database.prepare("SELECT status FROM system_cases").first<string>("status"),
    ).toBe("pending")
    expect(
      await fixture.database
        .prepare("SELECT outcome FROM system_decision_tasks")
        .first<string>("outcome"),
    ).toBeNull()
    expect(await new ApproveSystemTask(fixture.writer).execute(command)).toEqual({
      caseStatus: "approved",
      taskOutcome: "approved",
    })
  })

  test("提案、Case、Taskを同時作成し、quorumと次TaskをSystemだけで進める", async () => {
    const fixture = await createFixture()
    const at = new Date(200)
    const proposalId = proposalIdSchema.parse("proposal-1")
    const systemCaseId = systemCaseIdSchema.parse("case-1")
    const started = await new StartSystemProcedure({
      writer: fixture.writer,
      deps: {
        createProposalId: () => proposalId,
        createSystemCaseId: () => systemCaseId,
      },
    }).run({
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
    expect(started.proposal.id).toBe(proposalId)
    expect(started.workflowCase.id).toBe(systemCaseId)
    const next = nextTask(started.workflowCase.id, started.proposal.digest, new Date(220))
    const first = await new ApproveSystemTask(fixture.writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-1"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: null,
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

    const second = await new ApproveSystemTask(fixture.writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-2"),
      representedAccountId: zAccountId.parse("reviewer-2"),
      delegationId: null,
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

    const final = await new ApproveSystemTask(fixture.writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "final-review",
      round: 1,
      actorAccountId: zAccountId.parse("final-reviewer"),
      representedAccountId: zAccountId.parse("final-reviewer"),
      delegationId: null,
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
    const invalidStart = await new StartSystemProcedure({ writer: fixture.writer }).run({
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
    const start = new StartSystemProcedure({ writer: fixture.writer })
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
    await fixture.database
      .prepare("INSERT INTO system_procedure_numbers (procedure_key) VALUES ('change')")
      .run()
    const proposals = new SystemD1ProposalAdapter({ env: { DB: fixture.database } })
    expect(await proposals.findByNumber(first.number)).toMatchObject({
      version: 2,
      bodyJson: '{"amount":20}',
      caseId: second.workflowCase.id,
    })
    expect(await proposals.findByNumber(first.number, 1)).toMatchObject({
      version: 1,
      bodyJson: '{"amount":10}',
      caseId: first.workflowCase.id,
      status: "cancelled",
      digest: first.proposal.digest,
    })
    expect(await proposals.findByNumber(first.number, 3)).toBeNull()
    expect(await proposals.findByNumber(first.number + 100, 1)).toBeNull()
    for (const version of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(await proposals.findByNumber(first.number, version)).toBeInstanceOf(Error)
    }
    const hidden = new SystemD1ProposalAdapter({
      env: { DB: fixture.database },
      visibleCompletionOperationKeys: [],
    })
    expect(await hidden.findByNumber(first.number, 1)).toBeNull()
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
    const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
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
    const started = await new StartSystemProcedure({ writer: fixture.writer }).run({
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

    const rejected = await new RejectSystemTask(fixture.writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("reviewer-1"),
      representedAccountId: zAccountId.parse("reviewer-1"),
      delegationId: null,
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
