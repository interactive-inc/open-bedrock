import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { expect, test } from "bun:test"
import { z } from "zod"
import { app } from "@/api/app"
import { createAttendancePreservationFixture } from "@/contexts/attendance/test/create-attendance-preservation-fixture.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { createMonotonicTestClock } from "@tests/api/support/create-monotonic-test-clock"

// 複数ページの保全・承認・再検証を実HTTPとDBで通すため、個別に実行時間を確保する。
test("11件の打刻を全件保全し、人の承認・取消・再提出を経て原記録を残して撤去確定する", async () => {
  const f = await createAttendancePreservationFixture()
  const creator = f.governance.creator.accountId
  await f.database.exec(`INSERT INTO system_iam_role_permissions VALUES
    ('role:attendance-archive','system:admin'),
    ('role:attendance-archive','system:record:preserve'),
    ('role:attendance-archive','system:record:read'),
    ('role:attendance-archive','system:procedure:read')`)
  await f.database.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('role:retirement-review','retirement:review','custom','Record reviewer',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:retirement-review','system:procedure:read')`)
  await f.database
    .prepare(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('binding:retirement-review',?1,'role:retirement-review',0)`)
    .bind(f.reviewer.accountId)
    .run()
  for (const serial of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const id = `01900016-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`
    await f.database
      .prepare(`INSERT INTO attendance_records
      (id,employee_id,work_date,clock_in_at,note,status) VALUES (?1,?2,?3,?4,?5,'closed')`)
      .bind(
        id,
        f.governance.creator.employeeId,
        `2026-08-${String(serial).padStart(2, "0")}`,
        `2026-08-${String(serial).padStart(2, "0")}T00:00:00Z`,
        `Original ${serial}`,
      )
      .run()
  }
  const clock = createMonotonicTestClock()
  const at = clock()
  const secret = "attendance-pagination-test-jwt-secret"
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId: creator,
    tokenVersion: 0,
    now: at,
  })
  if (token instanceof Error) throw token
  const stepUpToken = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at) VALUES ('pagination-grant',?1,?2,'external_identity',?3,?4)`)
    .bind(creator, hash, at.getTime(), at.getTime() + 60_000)
    .run()
  const bindings = {
    get NOW() {
      return clock().toISOString()
    },
    DB: f.database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "attendance-pagination-test-pepper",
    RECORD_SOURCE_NAMESPACE: f.settings.sourceNamespace,
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    ...f.recordStorage,
  }
  const post = (path: string, id: string, body: unknown) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": id,
          "x-system-step-up": stepUpToken,
        },
        body: JSON.stringify(body),
      },
      bindings,
    )
  const freezeId = crypto.randomUUID()
  expect(
    (await post("/attendance/record-source-freezes", freezeId, { reason: "Preserve attendance" }))
      .status,
  ).toBe(201)
  const mappings = []
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(
    (serial) => `01900016-0000-7000-8000-${serial.toString(16).padStart(12, "0")}`,
  )) {
    const path = `/attendance-records/${id}/preservation-requests`
    const submitted = await f.request(path, {
      key: crypto.randomUUID(),
      body: {
        procedure_key: f.definition.key,
        conditions: {
          ...f.conditions,
          disclosure: {
            reason: "Archive verification",
            grants: [
              {
                accountId: creator,
                actions: ["read"],
                purposes: ["archive"],
                validFrom: at.toISOString(),
                validUntil: null,
              },
            ],
          },
        },
      },
    })
    if (submitted.status !== 201) throw new Error(await submitted.text())
    const record = z
      .object({ number: z.number(), record_id: z.string() })
      .parse(await submitted.json())
    const proposal = await openSystemProposals({ env: { DB: f.database } }).findByNumber(
      record.number,
    )
    if (proposal === null || proposal instanceof Error)
      throw new Error("missing preservation proposal")
    expect(
      (
        await f.request(`${path}/${record.number}/approve`, {
          accountId: f.reviewer.accountId,
          body: {
            decision_target: {
              proposal_version: proposal.version,
              proposal_digest: proposal.digest,
              task_key: proposal.currentTaskKey,
              task_round: proposal.currentTaskRound,
            },
            comment: "Reviewed original",
          },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await f.request(`${path}/${record.number}/execute`, {
          body: { proposal_digest: proposal.digest },
        })
      ).status,
    ).toBe(200)
    mappings.push({ sourceRecordId: id, preservedRecordId: record.record_id })
  }
  const sourcePath = `/attendance/record-source-freezes/${freezeId}`
  const planId = crypto.randomUUID()
  const firstCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    records: mappings.slice(0, 10),
  })
  if (firstCoverage.status !== 200) throw new Error(await firstCoverage.text())
  expect(await firstCoverage.json()).toMatchObject({
    sequence: 1,
    nextCursor: "01900016-0000-7000-8000-00000000000a",
    recordCount: 10,
  })
  expect(
    (await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })).status,
  ).toBe(503)
  const lastCoverage = await post(`${sourcePath}/coverage-pages`, crypto.randomUUID(), {
    purpose: "archive",
    records: mappings.slice(10),
  })
  if (lastCoverage.status !== 200) throw new Error(await lastCoverage.text())
  expect(await lastCoverage.json()).toMatchObject({ sequence: 2, nextCursor: null, recordCount: 1 })
  const planned = await post(`${sourcePath}/retirement-plans`, planId, { purpose: "archive" })
  if (planned.status !== 200) throw new Error(await planned.text())
  const publicPlan = z
    .object({ digest: z.string(), totalPages: z.number(), recordKinds: z.array(z.string()) })
    .parse(await planned.json())
  expect(publicPlan).toMatchObject({ totalPages: 2, recordKinds: ["attendance-record"] })
  const retirementPath = `/attendance/retirement-plans/${planId}/requests`
  const retirementDefinition = ProcedureDefinitionEntity.create({
    key: "attendance-retirement",
    revision: 1,
    title: "Retire preserved attendance",
    category: "system",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: JSON.parse(f.definition.decisionPolicyJson),
    completionOperationKey: "system.record.retire",
    createdByAccountId: creator,
    createdAt: at,
  })
  if (retirementDefinition instanceof Error) throw retirementDefinition
  expect(await openSystemProcedures(f.governance.context).publish(retirementDefinition, 0)).toBe(
    true,
  )
  const requestBody = {
    plan_digest: publicPlan.digest,
    procedure_key: retirementDefinition.key,
    reason: "Keep company records after removal",
  }
  const requestId = crypto.randomUUID()
  expect((await post(retirementPath, requestId, requestBody)).status).toBe(503)
  const verificationPath = `/attendance/retirement-plans/${planId}/verification-receipts`
  expect((await post(verificationPath, crypto.randomUUID(), { ordinal: 2 })).status).toBe(400)
  const firstId = crypto.randomUUID()
  const first = await post(verificationPath, firstId, {})
  if (first.status !== 200) throw new Error(await first.text())
  const firstReceipt = await first.json()
  expect(firstReceipt).toMatchObject({ ordinal: 1, planId })
  const replay = await post(verificationPath, firstId, {})
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual(firstReceipt)
  const originalKeys = bindings.ATTACHMENT_KEKS
  bindings.ATTACHMENT_KEKS = "{}"
  expect((await post(verificationPath, firstId, {})).status).toBe(503)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
      .bind(planId)
      .first<number>("n"),
  ).toBe(1)
  bindings.ATTACHMENT_KEKS = originalKeys
  const last = await post(verificationPath, crypto.randomUUID(), {})
  if (last.status !== 200) throw new Error(await last.text())
  expect(await last.json()).toMatchObject({ ordinal: 2, planId })
  expect((await post(verificationPath, crypto.randomUUID(), {})).status).toBe(409)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_retirement_receipts WHERE plan_id=?1")
      .bind(planId)
      .first<number>("n"),
  ).toBe(2)
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM attendance_records").first<number>("n"),
  ).toBe(11)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  const submitted = await post(retirementPath, requestId, requestBody)
  if (submitted.status !== 201) throw new Error(await submitted.text())
  const request = z
    .object({ number: z.number(), proposalDigest: z.string(), status: z.string() })
    .parse(await submitted.json())
  expect(request.status).toBe("pending")
  expect((await post(retirementPath, requestId, requestBody)).status).toBe(200)
  expect(
    (await post(retirementPath, requestId, { ...requestBody, reason: "Changed intent" })).status,
  ).toBe(409)
  const proposalReader = openSystemProposals({
    env: { DB: f.database },
    visibleCompletionOperationKeys: ["system.record.retire"],
  })
  const saved = await proposalReader.findByNumber(request.number)
  if (saved === null || saved instanceof Error) throw new Error("missing retirement proposal")
  const executePath = `${retirementPath}/${request.number}/execute`
  const executeBody = {
    proposal_version: saved.version,
    proposal_digest: saved.digest,
    plan_digest: publicPlan.digest,
  }
  expect((await post(executePath, crypto.randomUUID(), executeBody)).status).toBe(409)
  const decisionBody = {
    decision_target: {
      proposal_version: saved.version,
      proposal_digest: saved.digest,
      task_key: saved.currentTaskKey,
      task_round: saved.currentTaskRound,
    },
    comment: "Reviewed preserved attendance",
  }
  expect(
    (await post(`${retirementPath}/${request.number}/approve`, crypto.randomUUID(), decisionBody))
      .status,
  ).toBe(403)
  const reviewerToken = await new SystemAccessTokenIssuer(secret).issue({
    accountId: f.reviewer.accountId,
    tokenVersion: 0,
    now: clock(),
  })
  if (reviewerToken instanceof Error) throw reviewerToken
  const decide = (action: string, body: unknown) =>
    app.request(
      `${retirementPath}/${request.number}/${action}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${reviewerToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      bindings,
    )
  expect((await decide("reject", decisionBody)).status).toBe(200)
  expect((await post(executePath, crypto.randomUUID(), executeBody)).status).toBe(409)
  const resubmitted = await post(
    `${retirementPath}/${request.number}/resubmit`,
    crypto.randomUUID(),
    {
      ...requestBody,
      previous_version: saved.version,
      previous_digest: saved.digest,
    },
  )
  if (resubmitted.status !== 201) throw new Error(await resubmitted.text())
  expect(await resubmitted.json()).toMatchObject({ number: request.number, status: "pending" })
  const second = await proposalReader.findByNumber(request.number)
  if (second === null || second instanceof Error) throw new Error("missing retirement revision")
  expect(second.version).toBe(2)
  const withdrawal = {
    proposal_version: second.version,
    proposal_digest: second.digest,
    reason: "Recheck source removal",
  }
  expect((await decide("withdraw", withdrawal)).status).toBe(403)
  expect(
    (await post(`${retirementPath}/${request.number}/withdraw`, crypto.randomUUID(), withdrawal))
      .status,
  ).toBe(200)
  expect(
    (
      await post(`${retirementPath}/${request.number}/resubmit`, crypto.randomUUID(), {
        ...requestBody,
        previous_version: second.version,
        previous_digest: second.digest,
      })
    ).status,
  ).toBe(201)
  const latest = await proposalReader.findByNumber(request.number)
  if (latest === null || latest instanceof Error)
    throw new Error("missing final retirement proposal")
  expect(latest.version).toBe(3)
  expect((await decide("approve", decisionBody)).status).toBe(409)
  const latestDecision = {
    ...decisionBody,
    decision_target: {
      proposal_version: latest.version,
      proposal_digest: latest.digest,
      task_key: latest.currentTaskKey,
      task_round: latest.currentTaskRound,
    },
  }
  const approved = await decide("approve", latestDecision)
  if (approved.status !== 200) throw new Error(await approved.text())
  const finalBody = {
    proposal_version: latest.version,
    proposal_digest: latest.digest,
    plan_digest: publicPlan.digest,
  }
  const assignment = f.governance.resources.find(
    (resource) => resource.type === "responsibility-assignment",
  )
  if (assignment === undefined) throw new Error("missing company qualification")
  const reviewerAssignment = {
    ...assignment,
    attributes: {
      ...assignment.attributes,
      holderType: "employee",
      holderId: f.reviewer.employeeId,
      authorityScopeId: null,
    },
  }
  await f.governance.write([{ ...reviewerAssignment, revision: 3, state: "void" }])
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(403)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  await f.governance.write([{ ...reviewerAssignment, revision: 4 }])
  bindings.ATTACHMENT_KEKS = "{}"
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(503)
  bindings.ATTACHMENT_KEKS = originalKeys
  await f.database.exec(
    "CREATE TRIGGER fail_attendance_retirement BEFORE INSERT ON system_record_source_retirements BEGIN SELECT RAISE(ABORT,'injected finalization failure'); END;",
  )
  expect((await post(executePath, crypto.randomUUID(), finalBody)).status).toBe(409)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_execution_authorizations WHERE case_id=?1 AND used_at IS NOT NULL",
      )
      .bind(latest.caseId)
      .first<number>("n"),
  ).toBe(0)
  expect(await proposalReader.findByNumber(request.number)).toMatchObject({ status: "approved" })
  await f.database.exec("DROP TRIGGER fail_attendance_retirement")
  const finalized = await post(executePath, crypto.randomUUID(), finalBody)
  if (finalized.status !== 200) throw new Error(await finalized.text())
  const finalReceipt = await finalized.json()
  expect(await (await post(executePath, crypto.randomUUID(), finalBody)).json()).toEqual(
    finalReceipt,
  )
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_retirements")
      .first<number>("n"),
  ).toBe(1)
  expect(
    await f.database.prepare("SELECT count(*) AS n FROM attendance_records").first<number>("n"),
  ).toBe(11)
  expect(
    (
      await post(`${sourcePath}/release`, crypto.randomUUID(), {
        reason: "Cannot restart retired source",
      })
    ).status,
  ).toBe(409)
}, 30_000)
