import { createTestContextForDatabase } from "@tests/api/support/create-context-for-database"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import { featureGate } from "@/api/http/middlewares/feature-gate"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/env"
import { GET as deliveriesGET } from "@/contexts/onboarding/interface/routes/onboarding-lifecycle-deliveries"
import { POST as requeuePOST } from "@/contexts/onboarding/interface/routes/onboarding-lifecycle-deliveries.$jobId.requeue"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CompanyPersonnelEventRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-event.repository"
import { createLocalD1CompanyAssignment } from "@tests/d1/support/create-local-d1-company-assignment"
import { runScheduledOnboarding } from "@/api/scheduled/run-onboarding"
import { CompleteOnboardingTask } from "@/contexts/onboarding/application/complete-onboarding-task"
import { UpdateOnboardingAssignment } from "@/contexts/onboarding/application/update-onboarding-assignment"
import { ConflictError } from "@/lib/errors"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(12)
})

afterAll(async () => {
  await pool.dispose()
})

async function fixture() {
  const f = await createLocalD1CompanyAssignment(await pool.next())
  await f.assignEmployeeCode()
  await execSql(
    f.database,
    `INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('worker:lifecycle','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('principal:lifecycle','worker:lifecycle','service','Worker',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('role:lifecycle','onboarding:worker','custom','Worker',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:lifecycle','batch:execute'),('role:lifecycle','employee:read'),('role:lifecycle','onboarding:manage');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('binding:lifecycle','worker:lifecycle','role:lifecycle',0);
    INSERT INTO onboarding_templates (id,code,name,kind) VALUES (90001,'auto-join','Join','join'),(90002,'auto-leave','Leave','leave');
    INSERT INTO onboarding_template_tasks (template_code,code,title,sort_order) VALUES ('auto-join','join-task','Prepare access',1),('auto-leave','leave-task','Confirm return',1);
    INSERT INTO onboarding_lifecycle_template_bindings (effect_type,template_code,updated_at) VALUES ('hire','auto-join',0),('retired','auto-leave',0);`,
  )
  const clock = { at: new Date("2030-06-30T14:59:59.999Z") }
  const env = {
    ENABLED_OPT_IN_APPS: "onboarding",
    DB: f.database,
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    ONBOARDING_SERVICE_ACCOUNT_ID: "worker:lifecycle",
    ONBOARDING_AUTOMATION_FROM: "2030-06-01T00:00:00.000Z",
  }
  const run = () => runScheduledOnboarding({ env, clock: () => clock.at })
  const assignments = () =>
    f.database
      .prepare(
        "SELECT id,kind,status,lifecycle_action_id FROM onboarding_assignments WHERE lifecycle_action_id IS NOT NULL ORDER BY id",
      )
      .all()
  const retire = async () => {
    const retired = await f.personnel(
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-06-30"),
      },
      "automatic:exit",
    )
    if (retired instanceof Error) throw retired
    return retired.action.id
  }
  const correctRetirement = async (original: string, retirementOn: string, key: string) => {
    const correction = await f.personnel(
      {
        kind: "corrected",
        eventOn: restoreCalendarDate("2030-06-01"),
        correctsActionId: original,
        reason: "Correct retirement date",
        replacementAction: {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate(retirementOn),
        },
      },
      key,
    )
    if (correction instanceof Error) throw correction
    return correction.action.id
  }
  const deliverRetirement = async () => {
    const original = await retire()
    clock.at = new Date("2030-07-01T00:00:00Z")
    expect(await run()).toMatchObject([{ status: "succeeded" }])
    const generated = await f.database
      .prepare("SELECT id FROM onboarding_assignments WHERE lifecycle_action_id = ?1")
      .bind(original)
      .first<number>("id")
    if (generated === null) throw new Error("generated assignment missing")
    return { original, generated }
  }
  return { ...f, env, clock, run, assignments, retire, correctRetirement, deliverRetirement }
}

test("定期起動は会社の日付で退職翌日から手続きを一度だけ生成する", async () => {
  const f = await fixture()
  const actionId = await f.retire()
  expect(await f.run()).toEqual([])
  f.clock.at = new Date("2030-06-30T15:00:00Z")
  const results = await Promise.all([f.run(), f.run()])
  expect(
    results.some(
      (result) => !(result instanceof Error) && result.some((job) => job.status === "succeeded"),
    ),
  ).toBe(true)
  expect((await f.assignments()).results).toMatchObject([
    { kind: "leave", status: "in_progress", lifecycle_action_id: actionId },
  ])
  expect((await f.assignments()).results).toHaveLength(1)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS total FROM onboarding_tasks WHERE template_task_code = 'leave-task'",
      )
      .first<number>("total"),
  ).toBe(1)
  expect(await f.run()).toEqual([])
  const assignmentId = await f.database
    .prepare("SELECT id FROM onboarding_assignments WHERE lifecycle_action_id = ?1")
    .bind(actionId)
    .first<number>("id")
  if (assignmentId === null) throw new Error("generated assignment missing")
  const repository = new OnboardingAssignmentRepository(createTestContextForDatabase(f.database))
  const assignment = await repository.findById(assignmentId)
  if (assignment === null || assignment instanceof Error)
    throw new Error("generated assignment unreadable")
  expect(await repository.delete(assignment)).toBeNull()
  expect(await repository.findById(assignmentId)).toMatchObject({
    status: "in_progress",
    tasks: [{ status: "pending" }],
  })
})

test("訂正された元の発令を省き、訂正後の日付に退職手続きを生成する", async () => {
  const f = await fixture()
  const original = await f.retire()
  const correction = await f.personnel(
    {
      kind: "corrected",
      eventOn: restoreCalendarDate("2030-06-01"),
      correctsActionId: original,
      reason: "Correct retirement date",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-07-31"),
      },
    },
    "automatic:correct",
  )
  if (correction instanceof Error) throw correction
  f.clock.at = new Date("2030-07-01T00:00:00Z")
  expect(await f.run()).not.toBeInstanceOf(Error)
  expect((await f.assignments()).results).toEqual([])
  expect(
    await f.database
      .prepare("SELECT outcome FROM onboarding_lifecycle_deliveries WHERE action_id = ?1")
      .bind(original)
      .first<string>("outcome"),
  ).toBe("superseded")
  f.clock.at = new Date("2030-08-01T00:00:00Z")
  expect(await f.run()).not.toBeInstanceOf(Error)
  expect((await f.assignments()).results).toMatchObject([
    { kind: "leave", lifecycle_action_id: correction.action.id },
  ])
})

test("生成後に退職が訂正されたら、元のチェックリストを置換済みとして残し訂正後の手続きを生成する", async () => {
  const f = await fixture()
  const { original, generated } = await f.deliverRetirement()
  const correction = await f.correctRetirement(original, "2030-07-31", "automatic:late-correct")
  f.clock.at = new Date("2030-08-01T00:00:00Z")
  expect(await f.run()).toMatchObject([{ status: "succeeded" }])
  expect((await f.assignments()).results).toMatchObject([
    { id: generated, kind: "leave", status: "superseded", lifecycle_action_id: original },
    { kind: "leave", status: "in_progress", lifecycle_action_id: correction },
  ])
  expect(
    await f.database
      .prepare("SELECT status FROM onboarding_tasks WHERE assignment_id = ?1")
      .bind(generated)
      .first<string>("status"),
  ).toBe("pending")
  expect(
    await f.database
      .prepare(
        "SELECT reason_code, before_json, after_json FROM system_audit_events WHERE action = 'onboarding.lifecycle.assignment_superseded' AND target_id = ?1",
      )
      .bind(String(generated))
      .first<{ reason_code: string; before_json: string; after_json: string }>(),
  ).toEqual({
    reason_code: "personnel_action.corrected",
    before_json: JSON.stringify({ status: "in_progress" }),
    after_json: JSON.stringify({ status: "superseded" }),
  })

  const context = createTestContextForDatabase(f.database)
  const taskId = await f.database
    .prepare("SELECT id FROM onboarding_tasks WHERE assignment_id = ?1")
    .bind(generated)
    .first<number>("id")
  if (taskId === null) throw new Error("superseded task missing")
  const completed = await new CompleteOnboardingTask({
    assignmentRepository: new OnboardingAssignmentRepository(context),
  }).run({
    taskId,
    session: makeTestSession("root"),
    completedAt: "2030-08-01",
  })
  expect(completed).toBeInstanceOf(ConflictError)
  expect(completed).toMatchObject({ code: "assignment_superseded" })
  expect(
    await new UpdateOnboardingAssignment({
      assignmentRepository: new OnboardingAssignmentRepository(context),
      employeeDirectory: openCompanyEmployeeDirectory(context),
    }).run({
      assignmentId: generated,
      assignedAt: "2030-08-02",
      session: makeTestSession("root"),
    }),
  ).toMatchObject({ code: "not_modifiable" })
  const repository = new OnboardingAssignmentRepository(context)
  expect(await repository.completeTask(taskId, generated, "2030-08-01")).toBeNull()
  for (const sql of [
    "UPDATE onboarding_assignments SET status = 'in_progress' WHERE id = ?1",
    "DELETE FROM onboarding_assignments WHERE id = ?1",
    "UPDATE onboarding_tasks SET status = 'done', completed_at = '2030-08-01' WHERE assignment_id = ?1",
    "DELETE FROM onboarding_tasks WHERE assignment_id = ?1",
  ])
    expect(
      await f.database
        .prepare(sql)
        .bind(generated)
        .run()
        .then(
          () => null,
          (error: unknown) => error,
        ),
    ).toBeInstanceOf(Error)
  expect(await f.run()).toEqual([])
  expect((await f.assignments()).results).toHaveLength(2)
})

test("完了済みのチェックリストは訂正後も完了のまま残し、訂正後の手続きを別に生成する", async () => {
  const f = await fixture()
  const { original, generated } = await f.deliverRetirement()
  await f.database
    .prepare(
      "UPDATE onboarding_tasks SET status = 'done', completed_at = '2030-07-02' WHERE assignment_id = ?1",
    )
    .bind(generated)
    .run()
  await f.database
    .prepare("UPDATE onboarding_assignments SET status = 'completed' WHERE id = ?1")
    .bind(generated)
    .run()
  const correction = await f.correctRetirement(original, "2030-07-31", "automatic:done-correct")
  f.clock.at = new Date("2030-08-01T00:00:00Z")
  expect(await f.run()).toMatchObject([{ status: "succeeded" }])
  expect((await f.assignments()).results).toMatchObject([
    { id: generated, status: "completed", lifecycle_action_id: original },
    { status: "in_progress", lifecycle_action_id: correction },
  ])
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'onboarding.lifecycle.assignment_superseded'",
      )
      .first<number>("total"),
  ).toBe(0)
})

test("置換の監査に失敗したら置換と新しい割当を戻し、再試行で一度だけ置換する", async () => {
  const f = await fixture()
  const { original, generated } = await f.deliverRetirement()
  const correction = await f.correctRetirement(original, "2030-07-31", "automatic:retry-correct")
  f.clock.at = new Date("2030-08-01T00:00:00Z")
  await execSql(
    f.database,
    "CREATE TRIGGER fail_supersede_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'onboarding.lifecycle.assignment_superseded' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await f.run()).toMatchObject([{ status: "queued" }])
  expect((await f.assignments()).results).toMatchObject([
    { id: generated, status: "in_progress", lifecycle_action_id: original },
  ])
  expect((await f.assignments()).results).toHaveLength(1)
  await execSql(f.database, "DROP TRIGGER fail_supersede_audit")
  f.clock.at = new Date(f.clock.at.getTime() + 10000)
  expect(await f.run()).toMatchObject([{ status: "succeeded" }])
  expect((await f.assignments()).results).toMatchObject([
    { id: generated, status: "superseded" },
    { status: "in_progress", lifecycle_action_id: correction },
  ])
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'onboarding.lifecycle.assignment_superseded'",
      )
      .first<number>("total"),
  ).toBe(1)
})

test("訂正後の発令が現在の雇用と一致しなければ、元のチェックリストを置換済みにして新しく生成しない", async () => {
  const f = await fixture()
  const { original, generated } = await f.deliverRetirement()
  const correction = await f.correctRetirement(original, "2030-07-31", "automatic:obsolete-correct")
  const rehire = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "automatic:rehire-after-correct",
  )
  if (rehire instanceof Error) throw rehire
  f.clock.at = new Date("2030-09-01T00:00:00Z")
  expect(await f.run()).not.toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT outcome FROM onboarding_lifecycle_deliveries WHERE action_id = ?1")
      .bind(correction)
      .first<string>("outcome"),
  ).toBe("obsolete")
  expect((await f.assignments()).results).toMatchObject([
    { id: generated, kind: "leave", status: "superseded", lifecycle_action_id: original },
    { kind: "join", status: "in_progress", lifecycle_action_id: rehire.action.id },
  ])
})

test("再入社後の古い退職を省き、現在の入社手続きを生成する", async () => {
  const f = await fixture()
  const original = await f.retire()
  const rehire = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "automatic:rehire",
  )
  if (rehire instanceof Error) throw rehire
  f.clock.at = new Date("2030-09-01T00:00:00Z")
  expect(await f.run()).not.toBeInstanceOf(Error)
  expect((await f.assignments()).results).toMatchObject([
    { kind: "join", lifecycle_action_id: rehire.action.id },
  ])
  expect((await f.assignments()).results).toHaveLength(1)
  expect(
    await f.database
      .prepare("SELECT outcome FROM onboarding_lifecycle_deliveries WHERE action_id = ?1")
      .bind(original)
      .first<string>("outcome"),
  ).toBe("obsolete")
})

test("監査失敗では割当とタスクも戻し、再試行で同じ発令を完了する", async () => {
  const f = await fixture()
  await f.retire()
  f.clock.at = new Date("2030-07-01T00:00:00Z")
  await execSql(
    f.database,
    "CREATE TRIGGER fail_lifecycle_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'onboarding.lifecycle.assigned' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await f.run()).toMatchObject([{ status: "queued" }])
  expect((await f.assignments()).results).toEqual([])
  const invalidReceipt = await f.database
    .prepare("UPDATE onboarding_lifecycle_deliveries SET processed_at = ?1 WHERE outcome IS NULL")
    .bind(f.clock.at.getTime())
    .run()
    .then(
      () => null,
      (error: unknown) => error,
    )
  expect(invalidReceipt).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS total FROM onboarding_tasks WHERE template_task_code = 'leave-task'",
      )
      .first<number>("total"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER fail_lifecycle_audit")
  f.clock.at = new Date(f.clock.at.getTime() + 10000)
  expect(await f.run()).toMatchObject([{ status: "succeeded" }])
  expect((await f.assignments()).results).toHaveLength(1)
})

test("Serviceの権限・設定・App有効化が揃わなければ手続きを生成しない", async () => {
  const f = await fixture()
  await f.retire()
  f.clock.at = new Date("2030-07-01T00:00:00Z")
  expect(
    await runScheduledOnboarding({ env: { DB: f.database }, clock: () => f.clock.at }),
  ).toEqual([])
  expect(
    await runScheduledOnboarding({
      env: { ...f.env, ENABLED_OPT_IN_APPS: "none" },
      clock: () => f.clock.at,
    }),
  ).toEqual([])
  await execSql(
    f.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'onboarding:manage'",
  )
  expect(await f.run()).toBeInstanceOf(Error)
  expect((await f.assignments()).results).toEqual([])
})

test("保存準備中に退職が訂正されたら古い日付でチェックリストを作らない", async () => {
  const f = await fixture()
  const original = await f.retire()
  f.clock.at = new Date("2030-07-01T00:00:00Z")
  const read = CompanyPersonnelEventRepository.prototype.findEmploymentEffect.bind(
    new CompanyPersonnelEventRepository({ env: f.env }),
  )
  const intercepted = spyOn(
    CompanyPersonnelEventRepository.prototype,
    "findEmploymentEffect",
  ).mockImplementationOnce(async (id, on) => {
    const snapshot = await read(id, on)
    const corrected = await f.personnel(
      {
        kind: "corrected",
        eventOn: restoreCalendarDate("2030-06-01"),
        correctsActionId: original,
        reason: "Concurrent correction",
        replacementAction: {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-07-31"),
        },
      },
      "automatic:racing-correction",
    )
    if (corrected instanceof Error) throw corrected
    return snapshot
  })
  try {
    expect(await f.run()).toMatchObject([{ status: "queued" }])
    expect((await f.assignments()).results).toEqual([])
  } finally {
    intercepted.mockRestore()
  }
})

test("dead letterを人のstep-upと管理権限で一度だけ再投入し、修復後に手続きを生成する", async () => {
  const f = await fixture()
  await f.retire()
  f.clock.at = new Date("2030-07-01T00:00:00Z")
  await execSql(
    f.database,
    "DELETE FROM onboarding_template_tasks WHERE template_code = 'auto-leave'",
  )
  for (const attempt of [1, 2, 3, 4, 5]) {
    expect(await f.run()).toMatchObject([{ status: attempt === 5 ? "dead_letter" : "queued" }])
    f.clock.at = new Date(f.clock.at.getTime() + 300000)
  }
  const failed = await f.database
    .prepare("SELECT job_id FROM onboarding_lifecycle_deliveries WHERE outcome IS NULL")
    .first<string>("job_id")
  if (failed === null) throw new Error("failed job missing")
  await execSql(
    f.database,
    `INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('operator:retry','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('principal:retry','operator:retry','human','Operator',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('role:retry','onboarding:retry','custom','Operator',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:retry','system:admin');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('binding:retry','operator:retry','role:retry',0);`,
  )
  const secret = "lifecycle-test-jwt-secret"
  const accessToken = await new SystemAccessTokenIssuer(secret).issue({
    accountId: zAccountId.parse("operator:retry"),
    tokenVersion: 0,
    now: new Date(),
  })
  if (accessToken instanceof Error) throw accessToken
  const stepUpToken = "c".repeat(64)
  const stepUpHash = await new SystemPrincipalSecretService().hashRawSecret(stepUpToken)
  if (stepUpHash instanceof Error) throw stepUpHash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('grant:retry','operator:retry',?1,'password',?2,?3)`)
    .bind(stepUpHash, f.clock.at.getTime(), f.clock.at.getTime() + 300000)
    .run()
  const app = new Hono<HonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => f.clock.at)
      await next()
    })
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/deliveries", ...deliveriesGET)
    .post("/deliveries/:jobId/requeue", ...requeuePOST)
  const list = () =>
    app.request(
      "/deliveries",
      { headers: { authorization: `Bearer ${accessToken}` } },
      { ...f.context.env, ...f.env, JWT_SECRET: secret },
    )
  const listed = await list()
  expect(listed.status).toBe(200)
  expect(await listed.json()).toMatchObject({
    data: [{ job_id: failed, status: "dead_letter", attempt: 5, outcome: null }],
  })
  const request = (stepUp: boolean) =>
    app.request(
      `/deliveries/${failed}/requeue`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(stepUp ? { "x-system-step-up": stepUpToken } : {}),
        },
      },
      { ...f.context.env, ...f.env, JWT_SECRET: secret },
    )
  const missingStepUp = await request(false)
  expect({ status: missingStepUp.status, body: await missingStepUp.json() }).toMatchObject({
    status: 403,
  })
  const submitted = await request(true)
  expect(submitted.status).toBe(201)
  expect((await request(true)).status).toBe(200)
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM onboarding_lifecycle_deliveries")
      .first<number>("total"),
  ).toBe(2)
  await execSql(f.database, "DELETE FROM system_iam_role_permissions WHERE role_id = 'role:retry'")
  expect((await request(true)).status).toBe(403)
  expect((await list()).status).toBe(403)
  await execSql(
    f.database,
    "INSERT INTO onboarding_template_tasks (template_code,code,title,sort_order) VALUES ('auto-leave','leave-task','Confirm return',1)",
  )
  expect(await f.run()).toMatchObject([{ status: "succeeded" }])
  expect((await f.assignments()).results).toHaveLength(1)
})

test("入退社のHTTPも明示したApp有効化を要求する", async () => {
  const f = await fixture()
  const app = new Hono<HonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => f.clock.at)
      await next()
    })
    .use("*", featureGate)
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/onboarding/onboarding-lifecycle-deliveries", ...deliveriesGET)
  const path = "/onboarding/onboarding-lifecycle-deliveries"
  expect(
    (await app.request(path, {}, { ...f.context.env, ...f.env, ENABLED_OPT_IN_APPS: "none" }))
      .status,
  ).toBe(404)
  expect(
    (await app.request(path, {}, { ...f.context.env, ...f.env, ENABLED_OPT_IN_APPS: "onboarding" }))
      .status,
  ).toBe(401)
})
