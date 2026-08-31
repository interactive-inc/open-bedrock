import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as deadLettersGET } from "@system/interface/routes/system.dead-letters"
import { POST as deadLetterRequeuePOST } from "@system/interface/routes/system.dead-letters.$deadLetterId.requeue"
import { PATCH as deliveryPATCH } from "@system/interface/routes/system.deliveries.$deliveryId"
import {
  GET as deliveriesGET,
  POST as deliveriesPOST,
} from "@system/interface/routes/system.deliveries"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const accountId = zAccountId.parse("delivery-worker-account")
const jwtSecret = "system-session-test-jwt-secret"
const now = new Date("2026-01-01T00:00:00.000Z")

describe("System delivery HTTP", () => {
  test("Service Principalがjobを冪等登録・lease・dead letterへ進める", async () => {
    const fixture = new SystemSessionTestContext()
    seedWorker(fixture)
    const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, now)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) return
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/deliveries", ...deliveriesGET)
      .post("/system/deliveries", ...deliveriesPOST)
      .patch("/system/deliveries/:deliveryId", ...deliveryPATCH)
      .get("/system/dead-letters", ...deadLettersGET)
      .post("/system/dead-letters/:deadLetterId/requeue", ...deadLetterRequeuePOST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const created = await client.system.deliveries.$post({
      json: {
        kind: "job",
        id: "job:1",
        operation_key: "record.process",
        payload_digest: "a".repeat(64),
        idempotency_key: "command:1",
        max_attempts: 1,
        available_at: now.toISOString(),
      },
    })
    expect(created.status).toBe(201)
    const replayed = await client.system.deliveries.$post({
      json: {
        kind: "job",
        id: "job:replay",
        operation_key: "record.process",
        payload_digest: "a".repeat(64),
        idempotency_key: "command:1",
        max_attempts: 1,
        available_at: now.toISOString(),
      },
    })
    expect(replayed.status).toBe(200)

    const claimed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: "job:1" },
      json: { kind: "job", action: "claim", lease_seconds: 30 },
    })
    expect(claimed.status).toBe(200)
    const claimedBody = await claimed.json()
    expect("lease_token" in claimedBody).toBe(true)
    const leaseToken = "lease_token" in claimedBody ? claimedBody.lease_token : undefined
    if (leaseToken === undefined) return
    const failed = await client.system.deliveries[":deliveryId"].$patch({
      param: { deliveryId: "job:1" },
      json: {
        kind: "job",
        action: "fail",
        lease_token: leaseToken,
        error_code: "remote.failed",
        retry_at: new Date(now.getTime() + 1_000).toISOString(),
      },
    })
    expect(failed.status).toBe(200)
    expect(await failed.json()).toMatchObject({ delivery: { status: "dead_letter" } })
    const deadLetters = await client.system["dead-letters"].$get()
    expect(deadLetters.status).toBe(200)
    expect(await deadLetters.json()).toMatchObject({
      dead_letters: [{ sourceType: "job", sourceId: "job:1", reasonCode: "remote.failed" }],
    })
    const deadLetterBody = await (await client.system["dead-letters"].$get()).json()
    const deadLetterId = deadLetterBody.dead_letters[0]?.id
    if (deadLetterId === undefined) return
    const requeued = await client.system["dead-letters"][":deadLetterId"].requeue.$post({
      param: { deadLetterId },
      json: {
        max_attempts: 3,
        available_at: new Date(now.getTime() + 1_000).toISOString(),
        reason: "operator retry",
      },
    })
    expect(requeued.status).toBe(201)
    const deadLetterReplay = await client.system["dead-letters"][":deadLetterId"].requeue.$post({
      param: { deadLetterId },
      json: {
        max_attempts: 3,
        available_at: new Date(now.getTime() + 1_000).toISOString(),
        reason: "operator retry",
      },
    })
    expect(deadLetterReplay.status).toBe(200)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total FROM system_audit_events
           WHERE action = 'system.dead_letter.requeued'`,
        )
        .get(),
    ).toEqual({ total: 1 })
  })
})

function seedWorker(fixture: SystemSessionTestContext): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_principals
         (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('principal:worker', ?1, 'service', 'Worker', NULL, 1, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite.exec(
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('delivery-role', 'system:delivery', 'managed', 'Delivery', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('delivery-role', 'batch:view'),
            ('delivery-role', 'batch:write'),
            ('delivery-role', 'batch:execute'),
            ('delivery-role', 'system:admin');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('delivery-binding', 'delivery-worker-account', 'delivery-role', NULL, NULL, 1, NULL);`,
  )
}

async function issueAccessToken(fixture: SystemSessionTestContext): Promise<string | Error> {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  const result = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (result instanceof Error || result.kind === "rejected") {
    return result instanceof Error ? result : new Error(result.reason)
  }
  return result.accessToken
}
