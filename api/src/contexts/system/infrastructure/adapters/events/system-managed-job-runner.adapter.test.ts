import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { SystemManagedJobRunnerAdapter } from "@system/infrastructure/adapters/events/system-managed-job-runner.adapter"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

async function fixture(maxAttempts = 2) {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON")
  for (const name of ["system-core", "system-integration", "system-principal", "system-delivery"])
    sqlite.exec(readFileSync(new URL(`../../schema/${name}.sql`, import.meta.url), "utf8"))
  sqlite.exec(`INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('worker:1','active',0,0,0);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('principal:1','worker:1','service','Worker',1,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('role:1','worker','custom','Worker',0,0);
    INSERT INTO system_iam_role_permissions VALUES ('role:1','batch:execute');
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('binding:1','worker:1','role:1',0);
    CREATE TABLE effects (id TEXT PRIMARY KEY);`)
  const database = wrapSystemD1TestDatabase(sqlite)
  const clock = { at: new Date(1000) }
  const workerAccountId = zAccountId.parse("worker:1")
  const jobInput = {
    id: "job:1",
    kind: "job",
    handlerKey: "example.record",
    operationKey: "example.record",
    payloadDigest: "a".repeat(64),
    idempotencyKey: "event:1",
    status: "queued",
    attempt: 0,
    maxAttempts,
    availableAt: clock.at,
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: clock.at,
    updatedAt: clock.at,
    completedAt: null,
  }
  const queued = SystemDeliveryEntity.create(jobInput)
  if (queued instanceof Error) throw queued
  const repository = new SystemDeliveryRepository({ env: { DB: database } })
  expect(await repository.create(queued, workerAccountId, null, [])).toBe("created")
  const run = (
    prepare: (
      job: SystemDeliveryEntity,
      at: Date,
    ) => Promise<ReadonlyArray<D1PreparedStatement> | Error> = async (job) => [
      database.prepare("INSERT INTO effects VALUES (?1)").bind(job.id),
    ],
  ) =>
    new SystemManagedJobRunnerAdapter({
      env: { DB: database },
      workerAccountId,
      handlerKey: "example.record",
      clock: () => clock.at,
      prepare,
    }).run(10)
  return { sqlite, database, clock, jobInput, queued, repository, workerAccountId, run }
}

test("並行Workerでも業務とjobの完了を一回だけ保存する", async () => {
  const c = await fixture()
  const outcomes = await Promise.all([c.run(), c.run()])
  expect(outcomes.flat()).toEqual(expect.arrayContaining([{ id: "job:1", status: "succeeded" }]))
  expect(c.sqlite.query("SELECT * FROM effects").all()).toEqual([{ id: "job:1" }])
  expect(await c.repository.find("job", "job:1")).toMatchObject({
    status: "succeeded",
    handlerKey: "example.record",
  })
  expect(await c.run()).toEqual([])
})

test("業務または監査の保存失敗を再試行へ戻し、上限後にdead letterへ残す", async () => {
  const c = await fixture()
  c.sqlite.exec(
    "CREATE TRIGGER audit_failure BEFORE INSERT ON system_audit_events WHEN NEW.action = 'system.managed_job.succeeded' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await c.run()).toEqual([{ id: "job:1", status: "queued" }])
  expect(c.sqlite.query("SELECT * FROM effects").all()).toEqual([])
  expect(await c.run()).toEqual([])
  c.clock.at = new Date(11_000)
  expect(await c.run()).toEqual([{ id: "job:1", status: "dead_letter" }])
  expect(await c.repository.findDeadLetters()).toMatchObject([
    { sourceId: "job:1", attempt: 2, reasonCode: "handler.failed" },
  ])
})

test("失敗の原因を解消すると、同じjobと冪等性キーで業務を完了できる", async () => {
  const c = await fixture()
  expect(await c.run(async () => new Error("unavailable"))).toEqual([
    { id: "job:1", status: "queued" },
  ])
  c.clock.at = new Date(11_000)
  expect(await c.run()).toEqual([{ id: "job:1", status: "succeeded" }])
  expect(await c.repository.find("job", "job:1")).toMatchObject({
    attempt: 2,
    idempotencyKey: "event:1",
  })
})

test("準備中の権限失効とlease期限切れでは業務を保存しない", async () => {
  for (const kind of ["revoke", "expire"] as const) {
    const c = await fixture(1)
    const outcome = await c.run(async () => {
      if (kind === "revoke") c.sqlite.exec("UPDATE system_role_bindings SET revoked_at = 1000")
      else c.clock.at = new Date(61_000)
      return [c.database.prepare("INSERT INTO effects VALUES ('effect')")]
    })
    expect(outcome).toBeInstanceOf(Error)
    expect(c.sqlite.query("SELECT * FROM effects").all()).toEqual([])
    expect(await c.repository.find("job", "job:1")).toMatchObject({ status: "leased" })
    if (kind === "expire") expect(await c.run()).toEqual([{ id: "job:1", status: "dead_letter" }])
  }
})

test("人とAgentは登録処理のServiceを代替できない", async () => {
  for (const kind of ["human", "agent"] as const) {
    const c = await fixture()
    c.sqlite.prepare("UPDATE system_principals SET kind = ?1, revision = 2").run(kind)
    expect(await c.run()).toBeInstanceOf(Error)
    expect(await c.repository.find("job", "job:1")).toMatchObject({ status: "queued", attempt: 0 })
  }
})

test("同時刻のheartbeat後に古いlease状態で成功を書き込めない", async () => {
  const c = await fixture()
  const leased = c.queued.claim(c.workerAccountId, "b".repeat(64), c.clock.at, 10_000)
  if (leased instanceof Error) throw leased
  expect(await c.repository.update(c.queued, leased, [])).toBe("updated")
  const heartbeat = leased.heartbeat(c.workerAccountId, "b".repeat(64), c.clock.at, 20_000)
  const staleCompletion = leased.succeed(c.workerAccountId, "b".repeat(64), c.clock.at)
  if (heartbeat instanceof Error || staleCompletion instanceof Error)
    throw new Error("invalid test lease")
  expect(await c.repository.update(leased, heartbeat, [])).toBe("updated")
  expect(await c.repository.update(leased, staleCompletion, [])).toBe("conflict")
})

test("別の登録処理・未登録job・将来のjobは実行しない", async () => {
  const c = await fixture()
  for (const handlerKey of ["example.other", null, "example.record"]) {
    const job = SystemDeliveryEntity.create({
      ...c.jobInput,
      id: `job:${handlerKey ?? "unbound"}`,
      idempotencyKey: `event:${handlerKey ?? "unbound"}`,
      handlerKey,
      availableAt: new Date(2000),
    })
    if (job instanceof Error) throw job
    expect(await c.repository.create(job, c.workerAccountId, null, [])).toBe("created")
  }
  expect(await c.run()).toEqual([{ id: "job:1", status: "succeeded" }])
  c.clock.at = new Date(2000)
  expect(await c.run()).toEqual([{ id: "job:example.record", status: "succeeded" }])
  expect(c.sqlite.query("SELECT count(*) AS total FROM effects").get()).toEqual({ total: 2 })
})

test("業務の途中保存が失敗すると、先行保存とjob完了も取り消す", async () => {
  const c = await fixture()
  expect(
    await c.run(async () => [
      c.database.prepare("INSERT INTO effects VALUES ('effect:1')"),
      c.database.prepare("INSERT INTO effects VALUES ('effect:1')"),
    ]),
  ).toEqual([{ id: "job:1", status: "queued" }])
  expect(c.sqlite.query("SELECT * FROM effects").all()).toEqual([])
  expect(await c.repository.find("job", "job:1")).toMatchObject({ status: "queued", attempt: 1 })
})

test("dead letterの再投入でも登録処理と操作を保持し、別handlerへ付け替えない", async () => {
  const c = await fixture(1)
  expect(await c.run(async () => new Error("retry needed"))).toEqual([
    { id: "job:1", status: "dead_letter" },
  ])
  const letters = await c.repository.findDeadLetters()
  if (letters instanceof Error || letters[0] === undefined) throw new Error("missing dead letter")
  const id = letters[0].id
  for (const variant of ["unbound", "other_operation", "retained"]) {
    const job = SystemDeliveryEntity.create({
      ...c.jobInput,
      id: `retry:${variant}`,
      idempotencyKey: `dead-letter:${id}`,
      handlerKey: variant === "unbound" ? null : c.queued.handlerKey,
      operationKey: variant === "other_operation" ? "example.other" : c.queued.operationKey,
    })
    if (job instanceof Error) throw job
    const saved = await c.repository.requeueDeadLetter(id, job, c.workerAccountId, [])
    if (variant !== "retained") expect(saved).toBe("conflict")
    else expect(saved).toEqual({ status: "created", jobId: job.id })
  }
  expect(await c.run()).toEqual([{ id: "retry:retained", status: "succeeded" }])
})
