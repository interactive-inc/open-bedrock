import { createAttendanceSourceFreezeReadHandlers } from "@/contexts/attendance/interface/operations/create-attendance-source-freeze-read-handlers"
import { expect, test } from "bun:test"
import { Hono } from "hono"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { createAttendanceSourceFreezeHandlers } from "@/contexts/attendance/interface/operations/create-attendance-source-freeze-handlers"
import { createAttendanceRecordSourceFixture } from "@/contexts/attendance/test/create-attendance-record-source-fixture.test-support"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemHTTPException } from "@system/interface/errors"
import { app as generatedApp } from "@/api/app"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"

test("停止と解除のHTTP操作は再認証を要求し、同じ世代の再送で監査を増やさない", async () => {
  const f = await createAttendanceRecordSourceFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:recorder','system:admin')",
  )
  const raw = "c".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('route-grant','account:recorder',?1,'external_identity',?2,?3)`)
    .bind(hash, f.clock.now.getTime(), f.clock.now.getTime() + 60_000)
    .run()
  const app = new Hono()
  app.onError((error, c) => {
    if (error instanceof SystemHTTPException) return c.json({ error: error.message }, error.status)
    throw error
  })
  const identity = attendanceFactory.createMiddleware(async (c, next) => {
    c.set("userId", f.authentication.accountId)
    c.set("now", () => f.clock.now)
    c.set("bearerReadAuthentication", f.authentication)
    await next()
  })
  app.post("/freezes", identity, ...createAttendanceSourceFreezeHandlers("create"))
  app.post(
    "/freezes/:freezeId/release",
    identity,
    ...createAttendanceSourceFreezeHandlers("release"),
  )
  app.get("/freezes/:freezeId", identity, ...createAttendanceSourceFreezeReadHandlers())
  const read = (freezeId: string, namespace = "example-source") =>
    app.request(
      `/freezes/${freezeId}`,
      {},
      {
        DB: f.database,
        RECORD_SOURCE_NAMESPACE: namespace,
      },
    )
  const id = crypto.randomUUID()
  const request = (path: string, stepUp: boolean, reason = "Preserve source") =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": id,
          ...(stepUp ? { "x-system-step-up": raw } : {}),
        },
        body: JSON.stringify({ reason }),
      },
      { DB: f.database, RECORD_SOURCE_NAMESPACE: "example-source" },
    )
  expect((await request("/freezes", false)).status).toBe(403)
  expect(
    await f.database
      .prepare("SELECT count(*) AS n FROM system_record_source_freezes")
      .first<number>("n"),
  ).toBe(0)
  expect((await read(id)).status).toBe(404)
  expect((await read("invalid")).status).toBe(400)
  expect((await request("/freezes", true)).status).toBe(201)
  const active = await read(id)
  expect(active.status).toBe(200)
  expect(active.headers.get("Cache-Control")).toBe("no-store")
  expect(await active.json()).toMatchObject({ freeze: { id, revision: 1, release: null } })
  expect((await read(id, "other-source")).status).toBe(404)
  expect((await request("/freezes", true)).status).toBe(200)
  expect((await request("/freezes", true, "Changed reason")).status).toBe(409)
  expect(
    await f.database
      .prepare("UPDATE attendance_records SET note='blocked' WHERE id=1")
      .run()
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect((await request(`/freezes/${id}/release`, false)).status).toBe(403)
  expect((await request(`/freezes/${id}/release`, true, "Resume source")).status).toBe(200)
  expect((await request(`/freezes/${id}/release`, true, "Resume source")).status).toBe(200)
  expect((await request("/freezes", true)).status).toBe(200)
  const released = await read(id)
  expect(released.status).toBe(200)
  expect(await released.json()).toMatchObject({
    freeze: { id, revision: 2, release: { reason: "Resume source" } },
  })
  await f.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:admin'",
  )
  expect((await read(id)).status).toBe(403)
  expect(
    await f.database.prepare("UPDATE attendance_records SET note='resumed' WHERE id=1").run(),
  ).toMatchObject({ success: true })
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(2)
})

test("生成APIの署名検証から停止・参照・解除まで通し、失効したBearerを拒否する", async () => {
  const f = await createAttendanceRecordSourceFixture()
  await f.database.exec(
    "INSERT INTO system_iam_role_permissions VALUES ('role:recorder','system:admin')",
  )
  const secret = "attendance-freeze-generated-app-test-secret"
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId: f.authentication.accountId,
    tokenVersion: 0,
    now: f.clock.now,
  })
  if (token instanceof Error) throw token
  const raw = "d".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('generated-route-grant','account:recorder',?1,'external_identity',?2,?3)`)
    .bind(hash, f.clock.now.getTime(), f.clock.now.getTime() + 60_000)
    .run()
  const bindings = {
    DB: f.database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "attendance-freeze-generated-test-pepper",
    RECORD_SOURCE_NAMESPACE: "example-source",
    NOW: f.clock.now.toISOString(),
  }
  const id = crypto.randomUUID()
  const path = "/attendance/record-source-freezes"
  const request = (suffix: string, bearer: string, stepUp: boolean) =>
    generatedApp.request(
      path + suffix,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          "idempotency-key": id,
          ...(stepUp ? { "x-system-step-up": raw } : {}),
        },
        body: JSON.stringify({ reason: "Preserve source" }),
      },
      bindings,
    )
  expect((await request("", "invalid-token", true)).status).toBe(401)
  expect((await request("", token, false)).status).toBe(403)
  const created = await request("", token, true)
  expect(created.status).toBe(201)
  const read = () =>
    generatedApp.request(
      `${path}/${id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      bindings,
    )
  for (const [suffix, method] of [
    ["", "POST"],
    [`/${id}`, "GET"],
    [`/${id}/release`, "POST"],
    [`/${id}/coverage-pages`, "POST"],
  ]) {
    const disabled = await generatedApp.request(
      path + suffix,
      {
        method,
        headers: { authorization: `Bearer ${token}` },
      },
      { ...bindings, DISABLED_DEFAULT_APPS: "attendance" },
    )
    expect(disabled.status).toBe(404)
  }
  const active = await read()
  expect(active.status).toBe(200)
  expect(await active.json()).toMatchObject({ freeze: { id, revision: 1, release: null } })
  expect((await request(`/${id}/release`, token, true)).status).toBe(200)
  expect(await (await read()).json()).toMatchObject({ freeze: { id, revision: 2 } })
  await f.database.exec("UPDATE system_accounts SET token_version=1 WHERE id='account:recorder'")
  expect((await read()).status).toBe(401)
  expect((await request(`/${id}/release`, token, true)).status).toBe(401)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(2)
})
