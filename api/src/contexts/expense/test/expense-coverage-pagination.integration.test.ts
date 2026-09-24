import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { prepareSystemRecordRetirementDisclosure } from "@system/interface/operations/prepare-system-record-retirement-disclosure"
import { openSystemPreservedRecordDisclosurePolicies } from "@system/interface/operations/open-system-preserved-record-disclosure-policies"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemRecordRetirementRetention } from "@system/interface/operations/prepare-system-record-retirement-retention"
import { RecordRetirementVerificationReceiptRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-receipt.repository"
import { openSystemRecordRetirementVerificationPlans } from "@system/interface/operations/open-system-record-retirement-verification-plans"
import { PrepareExpenseRetirementPlanAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-retirement-plan.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { PrepareExpenseRetirementPageAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-retirement-page.adapter"
import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { PrepareExpenseRetirementCurrentStateAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-retirement-current-state.adapter"
import { expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createExpensePreservationFixture } from "@/contexts/expense/test/create-expense-preservation-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import {
  zAppExpenseRetirementPlan,
  zAppExpenseRetirementVerificationReceipt,
} from "@/contexts/expense/interface/http/response-schemas"
import { zAppExpenseCoveragePageReceipt } from "@/contexts/expense/interface/http/response-schemas"

// 全件保全から撤去後の取得まで実HTTP・DBで検査するため、CIの実行時間を個別に確保する。
test("経費照合は保存済みの続きから12件を照合し、飛越しと再認証失効を拒否する", async () => {
  const f = await createExpensePreservationFixture()
  await f.database.exec(`INSERT INTO system_iam_role_permissions VALUES
    ('role:expense-archive','system:record:preserve'),('role:expense-archive','system:record:read'),
    ('role:expense-archive','system:admin'),('role:expense-archive','expense:read:all');
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:archive-review','archive:review','custom','Review reader',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:archive-review','system:procedure:read')`)
  await f.database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:archive-review',?1,'role:archive-review',0)`)
    .bind(f.reviewer.accountId)
    .run()
  for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    await f.database
      .prepare(`INSERT INTO expense_budgets
      (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
      SELECT ?1,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at
      FROM expense_budgets WHERE id=1`)
      .bind(id)
      .run()
  }
  const mappings: Array<{ sourceRecordId: string; preservedRecordId: string }> = []
  for (const id of [1, 10, 11, 12, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const path = `/expense/records/expense-budget/${id}/preservation-requests`
    const submitted = await f.request(path, {
      key: crypto.randomUUID(),
      body: {
        procedure_key: f.definition.key,
        conditions: {
          ...f.conditions,
          preservation:
            id === 12
              ? {
                  kind: "retention",
                  retainUntil: new Date(Date.now() + 86400000).toISOString(),
                  reason: "Time limited archive",
                }
              : f.conditions.preservation,
          disclosure: {
            reason: "Archive access",
            grants: [
              {
                accountId: f.governance.creator.accountId,
                actions: ["read"],
                purposes: ["archive"],
                validFrom: new Date().toISOString(),
                validUntil: null,
              },
            ],
          },
        },
      },
    })
    expect(submitted.status).toBe(201)
    const receipt = z
      .object({ number: z.number(), record_id: z.string() })
      .parse(await submitted.json())
    const proposalPath = `${path}/${receipt.number}`
    const reviewed = await f.request(proposalPath, { accountId: f.reviewer.accountId })
    expect(reviewed.status).toBe(200)
    const review = z
      .object({
        decision_target: z.object({
          proposal_version: z.number(),
          proposal_digest: z.string(),
          task_key: z.string(),
          task_round: z.number(),
        }),
      })
      .parse(await reviewed.json())
    expect(
      (
        await f.request(`${proposalPath}/approve`, {
          accountId: f.reviewer.accountId,
          body: { comment: null, decision_target: review.decision_target },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await f.request(`${proposalPath}/execute`, {
          body: { proposal_digest: review.decision_target.proposal_digest },
        })
      ).status,
    ).toBe(200)
    mappings.push({ sourceRecordId: String(id), preservedRecordId: receipt.record_id })
  }
  const stepUp = "b".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUp)
  if (hash instanceof Error) throw hash
  const at = Date.now()
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('coverage-pagination-grant',?1,?2,'external_identity',?3,?4)`)
    .bind(f.governance.creator.accountId, hash, at, at + 60000)
    .run()
  const freezeId = crypto.randomUUID()
  expect(
    (
      await f.request("/expense/record-source-freezes", {
        key: freezeId,
        stepUp,
        body: { reason: "Verify all records" },
      })
    ).status,
  ).toBe(201)
  const path = `/expense/record-source-freezes/${freezeId}/coverage-pages`
  const first = {
    key: crypto.randomUUID(),
    stepUp,
    body: {
      recordKind: "expense-budget",
      purpose: "archive",
      records: mappings.slice(0, 10),
    },
  }
  expect((await f.request(path, { key: first.key, body: first.body })).status).toBe(403)
  expect(
    (await f.request(path, { ...first, body: { ...first.body, afterCursor: "7" } })).status,
  ).toBe(400)
  expect(
    (await f.request(path, { ...first, body: { ...first.body, records: mappings.slice(2) } }))
      .status,
  ).toBe(409)
  const firstResponse = await f.request(path, first)
  expect(firstResponse.status).toBe(200)
  const firstReceipt = zAppExpenseCoveragePageReceipt.parse(await firstResponse.json())
  expect(firstReceipt).toMatchObject({
    sequence: 1,
    afterCursor: null,
    nextCursor: "7",
    recordCount: 10,
  })
  expect((await f.request(path, { ...first, key: crypto.randomUUID() })).status).toBe(409)
  const second = {
    key: crypto.randomUUID(),
    stepUp,
    body: { ...first.body, records: mappings.slice(10) },
  }
  const secondResponse = await f.request(path, second)
  expect(secondResponse.status).toBe(200)
  const secondReceipt = zAppExpenseCoveragePageReceipt.parse(await secondResponse.json())
  expect(secondReceipt).toMatchObject({
    sequence: 2,
    afterCursor: "7",
    nextCursor: null,
    recordCount: 2,
  })
  expect(await (await f.request(path, first)).json()).toEqual(firstReceipt)
  expect(await (await f.request(path, second)).json()).toEqual(secondReceipt)
  expect((await f.request(path, { ...second, key: crypto.randomUUID() })).status).toBe(409)
  for (const recordKind of [
    "expense-record",
    "expense-approval",
    "expense-procedure-binding",
    "expense-attachment-link",
    "expense-attachment",
  ]) {
    expect(
      (
        await f.request(path, {
          key: crypto.randomUUID(),
          stepUp,
          body: {
            recordKind,
            purpose: "archive",
            records: [],
          },
        })
      ).status,
    ).toBe(200)
  }
  const planPath = `/expense/record-source-freezes/${freezeId}/retirement-plans`
  const planCommand = { key: crypto.randomUUID(), stepUp, body: { purpose: "archive" } }
  expect((await f.request(planPath, { ...planCommand, stepUp: undefined })).status).toBe(403)
  expect(
    (await f.request(planPath, { ...planCommand, body: { purpose: "archive", recordKinds: [] } }))
      .status,
  ).toBe(400)
  const plannedResponse = await f.request(planPath, planCommand)
  expect(plannedResponse.status).toBe(200)
  const publicPlan = zAppExpenseRetirementPlan.parse(await plannedResponse.json())
  expect(
    (
      await f.request(`/expense/retirement-plans/${publicPlan.id}/requests`, {
        key: crypto.randomUUID(),
        stepUp,
        body: {
          plan_digest: publicPlan.digest,
          procedure_key: "record-retirement",
          reason: "Request before verification",
        },
      })
    ).status,
  ).toBe(503)
  expect(publicPlan.totalPages).toBe(7)
  expect(publicPlan.recordKinds).toHaveLength(6)
  expect(await (await f.request(planPath, planCommand)).json()).toEqual(publicPlan)
  const verificationPath = `/expense/retirement-plans/${publicPlan.id}/verification-receipts`
  expect((await f.request(verificationPath, { key: crypto.randomUUID(), body: {} })).status).toBe(
    403,
  )
  expect(
    (await f.request(verificationPath, { key: crypto.randomUUID(), stepUp, body: { ordinal: 7 } }))
      .status,
  ).toBe(400)
  f.settings.disabledDefaultApps = "expenses"
  expect((await f.request(planPath, planCommand)).status).toBe(404)
  expect(
    (await f.request(verificationPath, { key: crypto.randomUUID(), stepUp, body: {} })).status,
  ).toBe(404)
  expect(
    (
      await f.request(`/expense/retirement-plans/${publicPlan.id}/requests`, {
        key: crypto.randomUUID(),
        stepUp,
        body: {
          plan_digest: publicPlan.digest,
          procedure_key: "record-retirement",
          reason: "Disabled source",
        },
      })
    ).status,
  ).toBe(404)
  f.settings.disabledDefaultApps = ""
  const retriedReceiptId = crypto.randomUUID()
  // oxlint-disable-next-line typescript/unbound-method -- 保存したメソッドは同じrepositoryをthisとしてcallする。
  const originalAppend = RecordRetirementVerificationReceiptRepository.prototype.append
  const intercepted = spyOn(
    RecordRetirementVerificationReceiptRepository.prototype,
    "append",
  ).mockImplementationOnce(
    async function (this: RecordRetirementVerificationReceiptRepository, receipt) {
      await f.database
        .prepare(
          "DELETE FROM system_iam_role_permissions WHERE role_id='role:expense-archive' AND permission_key='expense:read:all'",
        )
        .run()
      return originalAppend.call(this, receipt)
    },
  )
  try {
    expect(
      (await f.request(verificationPath, { key: retriedReceiptId, stepUp, body: {} })).status,
    ).toBe(503)
  } finally {
    intercepted.mockRestore()
  }
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
          .bind(publicPlan.id)
          .first("n"),
      ),
  ).toBe(0)
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.retirement.page.verified'",
          )
          .first("n"),
      ),
  ).toBe(0)
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:expense-archive','expense:read:all')",
  )
  const publicReceipts = []
  for (const ordinal of [1, 2, 3, 4, 5, 6, 7]) {
    const key = ordinal === 1 ? retriedReceiptId : crypto.randomUUID()
    const response = await f.request(verificationPath, { key, stepUp, body: {} })
    expect(response.status).toBe(200)
    const receipt = zAppExpenseRetirementVerificationReceipt.parse(await response.json())
    expect(receipt).toMatchObject({
      id: key,
      planId: publicPlan.id,
      planDigest: publicPlan.digest,
      ordinal,
    })
    expect(await (await f.request(verificationPath, { key, stepUp, body: {} })).json()).toEqual(
      receipt,
    )
    publicReceipts.push(receipt)
  }
  expect(
    (await f.request(verificationPath, { key: crypto.randomUUID(), stepUp, body: {} })).status,
  ).toBe(409)
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
          .bind(publicPlan.id)
          .first("n"),
      ),
  ).toBe(7)
  const retainedContext = {
    env: { DB: f.database },
    assertions: [f.database.prepare("SELECT 1")],
  }
  const retentionInput = { planId: publicPlan.id, planDigest: publicPlan.digest }
  const retention = await prepareSystemRecordRetirementRetention(
    retainedContext,
    retentionInput,
    new Date(),
  )
  if (retention instanceof Error) throw retention
  expect(retention.assertions).toHaveLength(4)
  expect(
    await prepareSystemRecordRetirementRetention(
      retainedContext,
      retentionInput,
      new Date(Date.now() + 172800000),
    ),
  ).toBeInstanceOf(Error)
  const disclosureClock = { offsetMs: 0 }
  const disclosureContext = {
    env: { DB: f.database },
    assertions: [f.database.prepare("SELECT 1")],
    now: () => new Date(Date.now() + disclosureClock.offsetMs),
  }
  const readAuthentication = {
    accountId: f.governance.creator.accountId,
    tokenVersion: 0,
    issuedAtMs: at - 1000,
    expiresAtMs: at + 60000,
    identityBindingId: null,
    machineCredentialId: null,
  }
  const disclosed = await prepareSystemRecordRetirementDisclosure(
    disclosureContext,
    retentionInput,
    readAuthentication,
  )
  if (disclosed instanceof Error) throw disclosed
  expect(disclosed.actorAccountId).toBe(f.governance.creator.accountId)
  expect(
    await prepareSystemRecordRetirementDisclosure(disclosureContext, retentionInput, {
      ...readAuthentication,
      accountId: f.reviewer.accountId,
    }),
  ).toBeInstanceOf(Error)
  await f.database
    .prepare(
      "DELETE FROM system_iam_role_permissions WHERE role_id='role:expense-archive' AND permission_key='system:record:read'",
    )
    .run()
  expect(
    await prepareSystemRecordRetirementDisclosure(
      disclosureContext,
      retentionInput,
      readAuthentication,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await f.database.batch([...disclosed.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:expense-archive','system:record:read')",
  )
  expect(
    await prepareSystemRecordRetirementDisclosure(
      disclosureContext,
      retentionInput,
      readAuthentication,
    ),
  ).not.toBeInstanceOf(Error)
  const retirementInput = { freezeId, sourceNamespace: "example-source", purpose: "archive" }
  const checks: Array<Awaited<ReturnType<PrepareExpenseRetirementCurrentStateAdapter["prepare"]>>> =
    []
  const pageChecks: Array<Awaited<ReturnType<PrepareExpenseRetirementPageAdapter["prepare"]>>> = []
  const plans: Array<Awaited<ReturnType<PrepareExpenseRetirementPlanAdapter["prepare"]>>> = []
  const retirementApp = expenseFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("database", f.governance.context.var.database)
      context.set("auditContext", f.governance.context.var.auditContext)
      context.set("now", () => new Date())
      context.set("bearerReadAuthentication", {
        accountId: f.governance.creator.accountId,
        tokenVersion: 0,
        issuedAtMs: at - 1000,
        expiresAtMs: at + 60000,
        identityBindingId: null,
        machineCredentialId: null,
      })
      await next()
    })
    .post("/plan", async (context) => {
      const planned = await new PrepareExpenseRetirementPlanAdapter(context).prepare(
        { ...retirementInput, id: crypto.randomUUID() },
        stepUp,
      )
      plans.push(planned)
      if (planned instanceof Error) return context.json({ prepared: false })
      const repository = openSystemRecordRetirementVerificationPlans({
        env: context.env,
        assertions: planned.assertions,
      })
      expect(await repository.append(planned.plan)).toBe("written")
      const restored = await repository.find(planned.plan.snapshot.id)
      if (restored instanceof Error || restored === null)
        throw new Error("saved plan missing", { cause: restored })
      expect(restored.digest).toBe(planned.plan.digest)
      expect(restored.target(7)).toEqual(planned.plan.target(7))
      return context.json({ prepared: true })
    })
    .post("/page", async (context) => {
      const checked = await new PrepareExpenseRetirementPageAdapter(context).prepare(
        await context.req.json(),
        stepUp,
      )
      pageChecks.push(checked)
      return context.json({ verified: !(checked instanceof Error) })
    })
    .post("/verify", async (context) => {
      const checked = await new PrepareExpenseRetirementCurrentStateAdapter(context).prepare(
        await context.req.json(),
        stepUp,
      )
      checks.push(checked)
      return context.json({ verified: !(checked instanceof Error) })
    })
  const completionInput = {
    planId: publicPlan.id,
    planDigest: publicPlan.digest,
    sourceNamespace: "example-source",
  }
  const verifyRetirement = async (input: unknown = completionInput) => {
    await retirementApp.request(
      "/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      { ...f.governance.context.env, ...f.recordStorage },
    )
    const checked = checks.at(-1)
    if (checked === undefined) throw new Error("retirement check missing")
    return checked
  }
  const verified = await verifyRetirement()
  if (verified instanceof Error) throw verified
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "record-retirement",
    revision: 1,
    title: "Retire source after preservation",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(f.definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: f.governance.creator.accountId,
    createdAt: new Date(),
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  const retirementPath = `/expense/retirement-plans/${publicPlan.id}/requests`
  const retirementCommand = {
    key: crypto.randomUUID(),
    stepUp,
    body: {
      plan_digest: publicPlan.digest,
      procedure_key: retirementDefinition.key,
      reason: "Retire frozen source and keep archived evidence",
    },
  }
  expect((await f.request(retirementPath, retirementCommand)).status).toBe(403)
  const publishedRetirement = await openSystemProcedures(f.governance.context).publish(
    retirementDefinition,
    0,
  )
  expect(publishedRetirement).toBe(true)
  expect(
    (
      await f.request(retirementPath, {
        ...retirementCommand,
        body: { ...retirementCommand.body, procedure_key: f.definition.key },
      })
    ).status,
  ).toBe(403)
  expect(
    (await f.request(retirementPath, { ...retirementCommand, stepUp: undefined })).status,
  ).toBe(403)
  const retirementAssignment = f.governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (retirementAssignment === undefined)
    throw new Error("retirement qualification fixture missing")
  const assignedReviewer = {
    ...retirementAssignment,
    attributes: {
      ...retirementAssignment.attributes,
      holderType: "employee",
      holderId: f.reviewer.employeeId,
      authorityScopeId: null,
    },
  }
  // oxlint-disable-next-line typescript/unbound-method -- 保存したメソッドは元のreceiverで呼び出す。
  const originalWorkflowStart = SystemD1WorkflowAdapter.prototype.start
  const revokedBeforeStart = spyOn(
    SystemD1WorkflowAdapter.prototype,
    "start",
  ).mockImplementationOnce(async function (this: SystemD1WorkflowAdapter, input) {
    await f.governance.write([{ ...assignedReviewer, revision: 3, state: "void" }])
    return originalWorkflowStart.call(this, input)
  })
  try {
    expect((await f.request(retirementPath, retirementCommand)).status).toBe(409)
  } finally {
    revokedBeforeStart.mockRestore()
  }
  const retirementCount = await f.database
    .prepare(
      "SELECT count(*) AS n FROM system_proposals WHERE json_extract(body_json,'$.operation')='system.record.retire'",
    )
    .first()
  expect(z.object({ n: z.number() }).parse(retirementCount).n).toBe(0)
  expect((await f.request(retirementPath, retirementCommand)).status).toBe(503)
  await f.governance.write([{ ...assignedReviewer, revision: 4 }])
  const retirementResponse = await f.request(retirementPath, retirementCommand)
  expect(retirementResponse.status).toBe(201)
  const retirementRequest = z
    .object({
      number: z.number(),
      caseId: z.string(),
      planId: z.string(),
      proposalDigest: z.string(),
      status: z.string(),
    })
    .parse(await retirementResponse.json())
  expect(retirementRequest.status).toBe("pending")
  const retirementReplay = await f.request(retirementPath, retirementCommand)
  expect(retirementReplay.status).toBe(200)
  expect(await retirementReplay.json()).toEqual(retirementRequest)
  expect(
    (
      await f.request(retirementPath, {
        ...retirementCommand,
        body: { ...retirementCommand.body, reason: "Different retirement intent" },
      })
    ).status,
  ).toBe(409)
  const savedRetirement = await openSystemProposals({
    env: f.governance.context.env,
    visibleCompletionOperationKeys: ["system.record.retire"],
  }).findByNumber(retirementRequest.number, 1)
  if (savedRetirement instanceof Error) throw savedRetirement
  if (savedRetirement === null) throw new Error("retirement proposal missing")
  const restoredRetirement = await RecordRetirementProposalValue.restore(
    JSON.parse(savedRetirement.bodyJson),
  )
  if (restoredRetirement instanceof Error) throw restoredRetirement
  expect(z.string().parse(restoredRetirement.props.digest.toString())).toBe(
    retirementRequest.proposalDigest,
  )
  const taskCandidates = await f.database
    .prepare("SELECT candidate_account_id FROM system_decision_task_candidates WHERE case_id=?1")
    .bind(retirementRequest.caseId)
    .all()
  expect(taskCandidates.results).toEqual([{ candidate_account_id: f.reviewer.accountId }])
  const reviewPath = `${retirementPath}/${retirementRequest.number}`
  const reviewOptions = { accountId: f.reviewer.accountId }
  const readRetirement = await f.request(reviewPath, reviewOptions)
  expect(readRetirement.status).toBe(200)
  expect(readRetirement.headers.get("cache-control")).toBe("no-store")
  const readSchema = z.object({
    number: z.number(),
    status: z.string(),
    body: z.unknown(),
    decision_target: z.object({
      proposal_version: z.number(),
      proposal_digest: z.string(),
      task_key: z.string(),
      task_round: z.number(),
    }),
  })
  const retirementReview = readSchema.parse(await readRetirement.json())
  expect(retirementReview.decision_target.proposal_digest).toBe(retirementRequest.proposalDigest)
  const presented = await RecordRetirementProposalValue.restore(retirementReview.body)
  if (presented instanceof Error) throw presented
  expect(z.string().parse(presented.props.digest.toString())).toBe(retirementRequest.proposalDigest)
  expect(presented.props.plan.snapshot.id).toBe(publicPlan.id)
  expect(presented.props.plan.snapshot.capability.recordKinds).toHaveLength(6)
  expect(
    (
      await f.request(
        `/expense/retirement-plans/${crypto.randomUUID()}/requests/${retirementRequest.number}`,
        reviewOptions,
      )
    ).status,
  ).toBe(404)
  f.settings.sourceNamespace = "another-source"
  expect((await f.request(reviewPath, reviewOptions)).status).toBe(404)
  f.settings.sourceNamespace = "example-source"
  await f.database
    .prepare(
      "INSERT INTO system_iam_role_permissions VALUES ('role:expense-archive','system:procedure:read')",
    )
    .run()
  expect((await f.request(reviewPath, {})).status).toBe(403)
  const readAuditCount = async () =>
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE target_id=?1 AND action='system.proposal.review.read'",
          )
          .bind(savedRetirement.proposalId)
          .first("n"),
      )
  expect(await readAuditCount()).toBe(1)
  await f.database
    .prepare(
      "DELETE FROM system_iam_role_permissions WHERE role_id='role:archive-review' AND permission_key='system:procedure:read'",
    )
    .run()
  expect((await f.request(reviewPath, reviewOptions)).status).toBe(403)
  await f.database
    .prepare(
      "INSERT INTO system_iam_role_permissions VALUES ('role:archive-review','system:procedure:read')",
    )
    .run()
  // oxlint-disable-next-line typescript/unbound-method -- 保存したメソッドは同じreceiverで呼び出す。
  const originalReviewAudit = SystemAuditEventRepository.prototype.append
  const lostReviewQualification = spyOn(
    SystemAuditEventRepository.prototype,
    "append",
  ).mockImplementationOnce(async function (this: SystemAuditEventRepository, event, before, after) {
    await f.governance.write([{ ...assignedReviewer, revision: 5, state: "void" }])
    return originalReviewAudit.call(this, event, before, after)
  })
  try {
    expect((await f.request(reviewPath, reviewOptions)).status).toBe(409)
  } finally {
    lostReviewQualification.mockRestore()
  }
  expect(await readAuditCount()).toBe(1)
  expect((await f.request(reviewPath, reviewOptions)).status).toBe(403)
  await f.governance.write([{ ...assignedReviewer, revision: 6 }])
  const reviewedAgain = await f.request(reviewPath, reviewOptions)
  expect(reviewedAgain.status).toBe(200)
  expect(readSchema.parse(await reviewedAgain.json())).toEqual(retirementReview)
  expect(await readAuditCount()).toBe(2)
  const approvalBody = {
    decision_target: retirementReview.decision_target,
    comment: "Retain archive before retirement",
  }
  const approvalOptions = { ...reviewOptions, body: approvalBody }
  expect(
    (
      await f.request(`${reviewPath}/approve`, {
        ...approvalOptions,
        accountId: f.governance.creator.accountId,
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await f.request(`${reviewPath}/approve`, {
        ...approvalOptions,
        body: {
          ...approvalBody,
          decision_target: { ...approvalBody.decision_target, proposal_digest: "0".repeat(64) },
        },
      })
    ).status,
  ).toBe(409)
  // oxlint-disable-next-line typescript/unbound-method -- 保存したwriterを同じreceiverで呼び出す。
  const originalDecision = SystemD1WorkflowAdapter.prototype.decide
  const lostDecisionQualification = spyOn(
    SystemD1WorkflowAdapter.prototype,
    "decide",
  ).mockImplementationOnce(async function (this: SystemD1WorkflowAdapter, input) {
    await f.governance.write([{ ...assignedReviewer, revision: 7, state: "void" }])
    return originalDecision.call(this, input)
  })
  try {
    expect((await f.request(`${reviewPath}/approve`, approvalOptions)).status).toBe(409)
  } finally {
    lostDecisionQualification.mockRestore()
  }
  const attestationCount = async () =>
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_human_attestations WHERE case_id=?1")
          .bind(retirementRequest.caseId)
          .first("n"),
      )
  expect(await attestationCount()).toBe(0)
  await f.governance.write([{ ...assignedReviewer, revision: 8 }])
  const approval = await f.request(`${reviewPath}/approve`, approvalOptions)
  expect(approval.status).toBe(200)
  expect(await approval.json()).toEqual({ status: "approved" })
  expect(await attestationCount()).toBe(1)
  expect((await f.request(`${reviewPath}/approve`, approvalOptions)).status).toBe(200)
  expect(await attestationCount()).toBe(1)
  expect(
    (
      await f.request(`${reviewPath}/approve`, {
        ...approvalOptions,
        body: { ...approvalBody, comment: "Changed decision" },
      })
    ).status,
  ).toBe(403)
  await f.governance.write([{ ...assignedReviewer, revision: 9, state: "void" }])
  expect((await f.request(`${reviewPath}/approve`, approvalOptions)).status).toBe(403)
  expect(await attestationCount()).toBe(1)
  await f.governance.write([{ ...assignedReviewer, revision: 10 }])
  expect((await f.request(`${reviewPath}/approve`, approvalOptions)).status).toBe(200)
  const negativeRequest = await f.request(retirementPath, {
    ...retirementCommand,
    key: crypto.randomUUID(),
  })
  expect(negativeRequest.status).toBe(201)
  const negativeNumber = z.object({ number: z.number() }).parse(await negativeRequest.json()).number
  const negativePath = `${retirementPath}/${negativeNumber}`
  const negativeReview = await f.request(negativePath, reviewOptions)
  expect(negativeReview.status).toBe(200)
  const negativeTarget = readSchema.parse(await negativeReview.json()).decision_target
  const withdrawalRequest = await f.request(retirementPath, {
    ...retirementCommand,
    key: crypto.randomUUID(),
  })
  expect(withdrawalRequest.status).toBe(201)
  const withdrawalReceipt = z
    .object({ number: z.number(), caseId: z.string(), proposalDigest: z.string() })
    .parse(await withdrawalRequest.json())
  const withdrawnReview = await f.request(
    `${retirementPath}/${withdrawalReceipt.number}`,
    reviewOptions,
  )
  expect(withdrawnReview.status).toBe(200)
  const withdrawnTarget = readSchema.parse(await withdrawnReview.json()).decision_target
  const withdrawalPath = `${retirementPath}/${withdrawalReceipt.number}/withdraw`
  const withdrawal = {
    body: {
      proposal_version: 1,
      proposal_digest: withdrawalReceipt.proposalDigest,
      reason: "Reconsider retirement",
    },
  }
  expect(
    (await f.request(withdrawalPath, { ...withdrawal, accountId: f.reviewer.accountId })).status,
  ).toBe(403)
  expect(
    (await f.request(withdrawalPath, { body: { ...withdrawal.body, proposal_version: 2 } })).status,
  ).toBe(409)
  expect(
    (
      await f.request(`${reviewPath}/withdraw`, {
        body: { ...withdrawal.body, proposal_digest: retirementRequest.proposalDigest },
      })
    ).status,
  ).toBe(409)
  await f.database.exec(
    "CREATE TRIGGER fail_retirement_withdrawal_audit BEFORE INSERT ON system_audit_events WHEN NEW.action='system.record.retirement.withdrawn' BEGIN SELECT RAISE(ABORT,'withdrawal audit failure'); END;",
  )
  expect((await f.request(withdrawalPath, withdrawal)).status).toBe(409)
  expect(
    z
      .string()
      .parse(
        await f.database
          .prepare("SELECT status FROM system_cases WHERE id=?1")
          .bind(withdrawalReceipt.caseId)
          .first("status"),
      ),
  ).toBe("pending")
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE target_id=?1 AND action='system.record.retirement.withdrawn'",
          )
          .bind(withdrawalReceipt.caseId)
          .first("n"),
      ),
  ).toBe(0)
  await f.database.exec("DROP TRIGGER fail_retirement_withdrawal_audit")
  const cancellation = await f.request(withdrawalPath, withdrawal)
  expect(cancellation.status).toBe(200)
  expect(await cancellation.json()).toEqual({ status: "cancelled" })
  expect((await f.request(withdrawalPath, withdrawal)).status).toBe(409)
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_audit_events WHERE target_id=?1 AND action='system.record.retirement.withdrawn'",
          )
          .bind(withdrawalReceipt.caseId)
          .first("n"),
      ),
  ).toBe(1)
  const resubmissionPath = `${retirementPath}/${withdrawalReceipt.number}/resubmit`
  const resubmission = {
    stepUp,
    body: {
      ...retirementCommand.body,
      previous_version: 1,
      previous_digest: withdrawalReceipt.proposalDigest,
      reason: "Resume retirement with retained evidence",
    },
  }
  expect(
    (
      await f.request(resubmissionPath, {
        ...resubmission,
        body: { ...resubmission.body, previous_digest: "0".repeat(64) },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await f.request(`${reviewPath}/resubmit`, {
        ...resubmission,
        body: { ...resubmission.body, previous_digest: retirementRequest.proposalDigest },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await f.request(`${negativePath}/resubmit`, {
        ...resubmission,
        body: { ...resubmission.body, previous_digest: negativeTarget.proposal_digest },
      })
    ).status,
  ).toBe(409)
  await f.database.exec(
    "CREATE TRIGGER fail_retirement_resubmission BEFORE INSERT ON system_decision_tasks WHEN EXISTS (SELECT 1 FROM system_cases WHERE id=NEW.case_id AND subject_version='2') BEGIN SELECT RAISE(ABORT,'resubmission task failure'); END;",
  )
  expect((await f.request(resubmissionPath, resubmission)).status).toBe(409)
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_proposals WHERE procedure_key=?1 AND version=2",
          )
          .bind(retirementDefinition.key)
          .first("n"),
      ),
  ).toBe(0)
  await f.database.exec("DROP TRIGGER fail_retirement_resubmission")
  const resubmitted = await f.request(resubmissionPath, resubmission)
  expect(resubmitted.status).toBe(201)
  const resubmittedReceipt = z
    .object({
      number: z.number(),
      caseId: z.string(),
      proposalDigest: z.string(),
      status: z.string(),
    })
    .parse(await resubmitted.json())
  expect(resubmittedReceipt.number).toBe(withdrawalReceipt.number)
  expect(resubmittedReceipt.caseId).not.toBe(withdrawalReceipt.caseId)
  expect(resubmittedReceipt.proposalDigest).not.toBe(withdrawalReceipt.proposalDigest)
  expect(resubmittedReceipt.status).toBe("pending")
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare(
            "SELECT count(*) AS n FROM system_proposals current JOIN system_proposals previous ON previous.id=current.supersedes_proposal_id JOIN system_proposal_numbers number ON number.series_id=current.series_id WHERE number.number=?1 AND current.version=2 AND previous.version=1 AND previous.digest=?2 AND current.digest=?3",
          )
          .bind(
            withdrawalReceipt.number,
            withdrawalReceipt.proposalDigest,
            resubmittedReceipt.proposalDigest,
          )
          .first("n"),
      ),
  ).toBe(1)
  const resubmittedReplay = await f.request(resubmissionPath, resubmission)
  expect(resubmittedReplay.status).toBe(200)
  expect(z.object({ caseId: z.string() }).parse(await resubmittedReplay.json()).caseId).toBe(
    resubmittedReceipt.caseId,
  )
  expect(
    (
      await f.request(resubmissionPath, {
        ...resubmission,
        body: { ...resubmission.body, reason: "Different revision under the same identity" },
      })
    ).status,
  ).toBe(409)
  expect((await f.request(withdrawalPath, withdrawal)).status).toBe(409)
  const resubmittedReview = await f.request(
    `${retirementPath}/${withdrawalReceipt.number}`,
    reviewOptions,
  )
  expect(resubmittedReview.status).toBe(200)
  const resubmittedTarget = readSchema.parse(await resubmittedReview.json()).decision_target
  expect(resubmittedTarget.proposal_version).toBe(2)
  expect(
    (
      await f.request(`${retirementPath}/${withdrawalReceipt.number}/approve`, {
        ...reviewOptions,
        body: { decision_target: withdrawnTarget, comment: "Obsolete decision" },
      })
    ).status,
  ).toBe(409)
  expect(resubmittedTarget.proposal_digest).toBe(resubmittedReceipt.proposalDigest)
  expect(
    z
      .string()
      .parse(
        await f.database
          .prepare("SELECT status FROM system_cases WHERE id=?1")
          .bind(withdrawalReceipt.caseId)
          .first("status"),
      ),
  ).toBe("cancelled")
  expect(
    z
      .string()
      .parse(
        await f.database
          .prepare("SELECT status FROM system_cases WHERE id=?1")
          .bind(resubmittedReceipt.caseId)
          .first("status"),
      ),
  ).toBe("pending")
  const executePath = `${reviewPath}/execute`
  const execution = {
    stepUp,
    body: {
      plan_digest: publicPlan.digest,
      proposal_version: 1,
      proposal_digest: retirementRequest.proposalDigest,
    },
  }
  expect(
    (
      await f.request(`${negativePath}/execute`, {
        ...execution,
        body: { ...execution.body, proposal_digest: negativeTarget.proposal_digest },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await f.request(executePath, {
        ...execution,
        body: { ...execution.body, proposal_version: 2 },
      })
    ).status,
  ).toBe(409)
  // oxlint-disable-next-line typescript/unbound-method -- 保存したwriterを同じreceiverで呼び出す。
  const originalExecution = SystemD1AuthorizedExecutionAdapter.prototype.execute
  const lostExecutionQualification = spyOn(
    SystemD1AuthorizedExecutionAdapter.prototype,
    "execute",
  ).mockImplementationOnce(async function (this: SystemD1AuthorizedExecutionAdapter, input) {
    await f.governance.write([{ ...assignedReviewer, revision: 11, state: "void" }])
    return originalExecution.call(this, input)
  })
  try {
    expect((await f.request(executePath, execution)).status).toBe(409)
  } finally {
    lostExecutionQualification.mockRestore()
  }
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_execution_authorizations WHERE case_id=?1")
          .bind(retirementRequest.caseId)
          .first("n"),
      ),
  ).toBe(0)
  await f.governance.write([{ ...assignedReviewer, revision: 12 }])
  await f.database.exec(
    "CREATE TRIGGER fail_retirement_final_audit BEFORE INSERT ON system_audit_events WHEN NEW.action='system.record.source.retired' BEGIN SELECT RAISE(ABORT,'final retirement audit failure'); END;",
  )
  expect((await f.request(executePath, execution)).status).toBe(409)
  expect(
    z
      .string()
      .parse(
        await f.database
          .prepare("SELECT status FROM system_cases WHERE id=?1")
          .bind(retirementRequest.caseId)
          .first("status"),
      ),
  ).toBe("approved")
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_execution_authorizations WHERE case_id=?1")
          .bind(retirementRequest.caseId)
          .first("n"),
      ),
  ).toBe(0)
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
          .first("n"),
      ),
  ).toBe(0)
  await f.database.exec("DROP TRIGGER fail_retirement_final_audit")
  const executed = await f.request(executePath, execution)
  expect(executed.status).toBe(200)
  const finalized = z
    .object({ retirement_id: z.uuid(), finalized_at: z.iso.datetime() })
    .parse(await executed.json())
  const executionReplay = await f.request(executePath, execution)
  expect(executionReplay.status).toBe(200)
  expect(await executionReplay.json()).toEqual(finalized)
  expect(
    z
      .string()
      .parse(
        await f.database
          .prepare("SELECT status FROM system_cases WHERE id=?1")
          .bind(retirementRequest.caseId)
          .first("status"),
      ),
  ).toBe("executed")
  expect(
    z
      .number()
      .parse(
        await f.database
          .prepare("SELECT count(*) AS n FROM system_record_source_retirements WHERE id=?1")
          .bind(finalized.retirement_id)
          .first("n"),
      ),
  ).toBe(1)
  expect(
    z
      .number()
      .parse(await f.database.prepare("SELECT count(*) AS n FROM expense_budgets").first("n")),
  ).toBe(12)
  expect(
    (
      await f.request(`/expense/record-source-freezes/${freezeId}/release`, {
        stepUp,
        body: { reason: "Cannot reopen a retired source" },
      })
    ).status,
  ).toBe(409)
  const deletionFailure = await f.database
    .prepare("DELETE FROM system_record_source_retirements WHERE id=?1")
    .bind(finalized.retirement_id)
    .run()
    .catch((cause: unknown) => cause)
  expect(deletionFailure).toBeInstanceOf(Error)
  if (!(deletionFailure instanceof Error)) throw new Error("retirement deletion should fail")
  expect(deletionFailure.message).toContain("record_source_retirement_immutable")
  expect(
    await verifyRetirement({ ...completionInput, sourceNamespace: "different" }),
  ).toBeInstanceOf(Error)
  expect(await verifyRetirement({ ...completionInput, planDigest: "0".repeat(64) })).toBeInstanceOf(
    Error,
  )
  for (const permission of ["budget:manage", "expense:read:all", "system:record:read"]) {
    await f.database
      .prepare(
        "DELETE FROM system_iam_role_permissions WHERE role_id='role:expense-archive' AND permission_key=?1",
      )
      .bind(permission)
      .run()
    expect(await verifyRetirement()).toBeInstanceOf(Error)
    expect((await f.request(retirementPath, retirementCommand)).status).not.toBe(200)
    expect(
      await f.database.batch([...verified.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    await f.database
      .prepare("INSERT INTO system_iam_role_permissions VALUES ('role:expense-archive',?1)")
      .bind(permission)
      .run()
    expect(await verifyRetirement()).not.toBeInstanceOf(Error)
  }
  const configuredKeys = f.recordStorage.ATTACHMENT_KEKS
  f.recordStorage.ATTACHMENT_KEKS = "{}"
  expect(await verifyRetirement()).toBeInstanceOf(Error)
  f.recordStorage.ATTACHMENT_KEKS = configuredKeys
  expect(await verifyRetirement()).not.toBeInstanceOf(Error)
  expect(verified.kinds).toHaveLength(6)
  expect(verified.kinds.find((kind) => kind.recordKind === "expense-budget")).toMatchObject({
    pageCount: 2,
    recordCount: 12,
  })
  const budget = verified.kinds.find((kind) => kind.recordKind === "expense-budget")
  if (budget === undefined) throw new Error("budget coverage missing")
  const pageInput = {
    ...retirementInput,
    recordKind: "expense-budget",
    terminalDigest: budget.terminalDigest,
  }
  const verifyPage = async (input: unknown) => {
    await retirementApp.request(
      "/page",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      { ...f.governance.context.env, ...f.recordStorage },
    )
    const checked = pageChecks.at(-1)
    if (checked === undefined) throw new Error("page verification missing")
    return checked
  }
  await retirementApp.request(
    "/plan",
    { method: "POST" },
    { ...f.governance.context.env, ...f.recordStorage },
  )
  const preparedPlan = plans.at(-1)
  if (preparedPlan === undefined || preparedPlan instanceof Error)
    throw new Error("plan preparation failed", { cause: preparedPlan })
  const restoredPlan = await RecordRetirementVerificationPlanEntity.restore(
    JSON.parse(JSON.stringify(preparedPlan.plan.snapshot)),
    preparedPlan.plan.digest,
  )
  if (restoredPlan instanceof Error) throw restoredPlan
  expect(restoredPlan.totalPages).toBe(7)
  expect(restoredPlan.snapshot.capability.recordKinds).toHaveLength(6)
  for (const ordinal of [1, 2, 3, 4, 5, 6, 7]) {
    const target = restoredPlan.target(ordinal)
    if (target instanceof Error) throw target
    expect(
      await verifyPage({
        freezeId: target.freezeId,
        sourceNamespace: target.sourceNamespace,
        purpose: target.purpose,
        recordKind: target.recordKind,
        sequence: target.sequence,
        terminalDigest: target.terminalDigest,
      }),
    ).not.toBeInstanceOf(Error)
  }
  const firstPage = await verifyPage({ ...pageInput, sequence: 1 })
  if (firstPage instanceof Error) throw firstPage
  expect(firstPage.records).toHaveLength(10)
  expect(firstPage.nextSequence).toBe(2)
  const secondPage = await verifyPage({ ...pageInput, sequence: 2 })
  if (secondPage instanceof Error) throw secondPage
  expect(secondPage.records).toHaveLength(2)
  expect(secondPage.nextSequence).toBeNull()
  expect(await verifyPage({ ...pageInput, sequence: 3 })).toBeInstanceOf(Error)
  expect(
    await verifyPage({ ...pageInput, sequence: 1, terminalDigest: "0".repeat(64) }),
  ).toBeInstanceOf(Error)
  const firstMapping = mappings.at(0)
  if (firstMapping === undefined) throw new Error("missing first mapping")
  const preserved = await f.database
    .prepare(`SELECT record.attachment_id,record.preservation_id,attachment.plaintext_sha256
    FROM system_preserved_records record JOIN system_attachments attachment ON attachment.id=record.attachment_id
    WHERE record.id=?1`)
    .bind(firstMapping.preservedRecordId)
    .first<{ attachment_id: string; preservation_id: string; plaintext_sha256: string }>()
  if (preserved === null) throw new Error("missing preserved record")
  const policyId = z
    .string()
    .parse(
      await f.database
        .prepare("SELECT disclosure_policy_id FROM system_preserved_records WHERE id=?1")
        .bind(firstMapping.preservedRecordId)
        .first("disclosure_policy_id"),
    )
  const policies = openSystemPreservedRecordDisclosurePolicies({
    env: { DB: f.database },
    assertions: [f.database.prepare("SELECT 1")],
  })
  const originalPolicy = await policies.findCurrent(policyId)
  if (originalPolicy instanceof Error || originalPolicy === null)
    throw new Error("policy missing", { cause: originalPolicy })
  const publishPolicy = async (changes: Readonly<Record<string, unknown>>) => {
    const previousPolicy = await policies.findCurrent(policyId)
    if (previousPolicy instanceof Error || previousPolicy === null)
      throw new Error("policy missing", { cause: previousPolicy })
    const policy = PreservedRecordDisclosurePolicyEntity.create({
      ...originalPolicy.snapshot,
      revision: previousPolicy.snapshot.revision + 1,
      auditEventId: crypto.randomUUID(),
      publishedAt: new Date().toISOString(),
      ...changes,
    })
    if (policy instanceof Error) throw policy
    const audit = SystemAuditEventEntity.restore({
      eventId: policy.snapshot.auditEventId,
      actorAccountId: policy.snapshot.actorAccountId,
      action: "system.record.disclosure_policy.published",
      targetType: "system:record-disclosure-policy",
      targetId: policy.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: JSON.stringify(previousPolicy.snapshot),
      afterJson: JSON.stringify(policy.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(policy.snapshot.publishedAt),
    })
    if (audit instanceof Error) throw audit
    await f.database.batch([...policies.preparePublish(policy, audit)])
  }
  for (const changes of [
    { status: "revoked" },
    { grants: originalPolicy.snapshot.grants.map((grant) => ({ ...grant, actions: ["export"] })) },
    {
      grants: originalPolicy.snapshot.grants.map((grant) => ({
        ...grant,
        purposes: ["different"],
      })),
    },
    {
      grants: originalPolicy.snapshot.grants.map((grant) => ({
        ...grant,
        accountId: "account:other",
      })),
    },
    {
      grants: originalPolicy.snapshot.grants.map((grant) => ({
        ...grant,
        validFrom: new Date(Date.now() + 30000).toISOString(),
      })),
    },
    {
      grants: originalPolicy.snapshot.grants.map((grant) => ({
        ...grant,
        validFrom: new Date(Date.now() - 20000).toISOString(),
        validUntil: new Date(Date.now() - 1000).toISOString(),
      })),
    },
  ]) {
    await publishPolicy(changes)
    expect(
      await prepareSystemRecordRetirementDisclosure(
        disclosureContext,
        retentionInput,
        readAuthentication,
      ),
    ).toBeInstanceOf(Error)
    expect(await verifyRetirement()).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...verified.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect(
      await f.database.batch([...disclosed.assertions]).catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    await publishPolicy({})
    expect(
      await prepareSystemRecordRetirementDisclosure(
        disclosureContext,
        retentionInput,
        readAuthentication,
      ),
    ).not.toBeInstanceOf(Error)
    expect(await verifyRetirement()).not.toBeInstanceOf(Error)
  }
  const holdPath = `/system/attachments/${preserved.attachment_id}/preservations`
  expect(
    (
      await f.request(`${holdPath}/${preserved.preservation_id}/release`, {
        stepUp,
        body: {
          operationId: crypto.randomUUID(),
          expectedRevision: 1,
          reason: "End original hold",
        },
      })
    ).status,
  ).toBe(200)
  expect((await f.request(path, first)).status).toBe(503)
  expect(
    (
      await f.request(holdPath, {
        stepUp,
        body: {
          id: crypto.randomUUID(),
          sha256: preserved.plaintext_sha256,
          kind: "hold",
          retainUntil: null,
          reason: "Independent later hold",
        },
      })
    ).status,
  ).toBe(201)
  expect((await f.request(path, first)).status).toBe(503)
  expect(await (await f.request(path, second)).json()).toEqual(secondReceipt)
  const budgetPageReceipts = []
  for (const receipt of publicReceipts) {
    const page = await f.database
      .prepare("SELECT record_kind,sequence FROM system_record_coverage_pages WHERE id=?1")
      .bind(receipt.coveragePageId)
      .first<{ record_kind: string; sequence: number }>()
    if (page?.record_kind === "expense-budget")
      budgetPageReceipts.push({ ...receipt, sequence: page.sequence })
  }
  expect(budgetPageReceipts).toHaveLength(2)
  for (const receipt of budgetPageReceipts)
    expect((await f.request(verificationPath, { key: receipt.id, stepUp, body: {} })).status).toBe(
      receipt.sequence === 1 ? 503 : 200,
    )
  expect(
    await prepareSystemRecordRetirementRetention(retainedContext, retentionInput, new Date()),
  ).toBeInstanceOf(Error)
  expect((await f.request(`${reviewPath}/approve`, approvalOptions)).status).toBe(409)
  const negativeOptions = {
    ...reviewOptions,
    body: { decision_target: negativeTarget, comment: "Preservation condition was lost" },
  }
  const rejected = await f.request(`${negativePath}/reject`, negativeOptions)
  expect(rejected.status).toBe(200)
  expect(await rejected.json()).toEqual({ status: "rejected" })
  expect((await f.request(`${negativePath}/reject`, negativeOptions)).status).toBe(200)
  expect(
    await f.database.batch([...retention.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await verifyRetirement()).toBeInstanceOf(Error)
  expect(await verifyPage({ ...pageInput, sequence: 1 })).toBeInstanceOf(Error)
  expect(await verifyPage({ ...pageInput, sequence: 2 })).not.toBeInstanceOf(Error)
  expect(
    await f.database.batch([...firstPage.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(
    await f.database.batch([...verified.assertions]).catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  await publishPolicy({ publishedAt: new Date(Date.now() + 30000).toISOString() })
  expect(
    await prepareSystemRecordRetirementDisclosure(
      disclosureContext,
      retentionInput,
      readAuthentication,
    ),
  ).toBeInstanceOf(Error)
  disclosureClock.offsetMs = 31000
  expect(
    await prepareSystemRecordRetirementDisclosure(
      disclosureContext,
      retentionInput,
      readAuthentication,
    ),
  ).not.toBeInstanceOf(Error)
  disclosureClock.offsetMs = 0
  await f.database
    .prepare("UPDATE system_step_up_grants SET revoked_at=?1 WHERE id='coverage-pagination-grant'")
    .bind(Date.now())
    .run()
  expect((await f.request(path, second)).status).toBe(403)
  const lastReceipt = publicReceipts.at(-1)
  if (lastReceipt === undefined) throw new Error("retirement receipt missing")
  expect(
    (await f.request(verificationPath, { key: lastReceipt.id, stepUp, body: {} })).status,
  ).toBe(403)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_coverage_pages WHERE freeze_id=?1")
      .bind(freezeId)
      .first<number>("n"),
  ).toBe(7)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='system.record.coverage.page.verified'",
      )
      .first<number>("n"),
  ).toBe(7)
}, 15_000)
