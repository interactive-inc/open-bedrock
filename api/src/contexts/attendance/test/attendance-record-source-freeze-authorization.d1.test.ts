import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["identity-provider-reauthentication", "read-only-principals"],
  })
})

afterAll(async () => {
  await local.dispose()
})

test("外部IdPの再認証を受け付け、準備後のgrant取消では停止と監査を保存しない", async () => {
  const f = await createAttendanceRecordSourceFixture(
    await local.database("identity-provider-reauthentication"),
  )
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('0a05519b-05c9-4925-8b15-fcb647569867','system:admin')",
  )
  const raw = "a".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  const now = new Date()
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at,last_used_at)
    VALUES ('freeze-grant','account:recorder',?1,'external_identity',?2,?3,?2)`)
    .bind(hash, now.getTime(), now.getTime() + 60_000)
    .run()
  const adapterContext = f.context
  const input = { authentication: f.authentication, now, stepUpToken: raw }
  const proof = await prepareSystemRecordSourceFreezeAuthorization(adapterContext, input)
  if (proof instanceof Error || proof === "forbidden") throw new Error("external step-up rejected")
  await f.database.batch([...proof.assertions])
  await f.database
    .prepare("UPDATE system_step_up_grants SET revoked_at=?1 WHERE id='freeze-grant'")
    .bind(now.getTime())
    .run()
  expect(await prepareSystemRecordSourceFreezeAuthorization(adapterContext, input)).toBe(
    "forbidden",
  )
  const service = new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({
      env: f.context.env,
      assertions: proof.assertions,
    }),
  })
  expect(
    await service.execute(
      {
        id: crypto.randomUUID(),
        sourceNamespace: "example-source",
        ownerContext: "attendance",
        actorAccountId: proof.actorAccountId,
        reason: "Preserve before retirement",
      },
      now,
    ),
  ).toBeInstanceOf(Error)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_freezes")
      .first<number>("n"),
  ).toBe(0)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(0)
})

test("閲覧権限だけの主体・機械・未使用grantを拒否し、読取でも後からの権限取消を検査する", async () => {
  const f = await createAttendanceRecordSourceFixture(await local.database("read-only-principals"))
  const adapterContext = f.context
  const now = new Date()
  const input = { authentication: f.authentication, now, stepUpToken: null }
  expect(await prepareSystemRecordSourceFreezeAuthorization(adapterContext, input)).toBe(
    "forbidden",
  )
  await execSql(
    f.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('0a05519b-05c9-4925-8b15-fcb647569867','system:admin')",
  )
  expect(
    await prepareSystemRecordSourceFreezeAuthorization(adapterContext, {
      ...input,
      authentication: { ...f.authentication, machineCredentialId: "machine" },
    }),
  ).toBe("forbidden")
  const proof = await prepareSystemRecordSourceFreezeAuthorization(adapterContext, input)
  if (proof instanceof Error || proof === "forbidden") throw new Error("human admin read rejected")
  const raw = "b".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('unused-grant','account:recorder',?1,'external_identity',?2,?3)`)
    .bind(hash, now.getTime(), now.getTime() + 60_000)
    .run()
  expect(
    await prepareSystemRecordSourceFreezeAuthorization(adapterContext, {
      ...input,
      stepUpToken: raw,
    }),
  ).toBe("forbidden")
  await execSql(
    f.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:admin'",
  )
  expect(
    await f.database.batch([...proof.assertions]).catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
})
