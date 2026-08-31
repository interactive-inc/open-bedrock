import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { PATCH as connectorPATCH } from "@system/interface/routes/system.connectors.$connectorId"
import {
  GET as connectorsGET,
  POST as connectorsPOST,
} from "@system/interface/routes/system.connectors"
import { POST as machineSessionPOST } from "@system/interface/routes/system.machine-sessions"
import {
  GET as exchangeGET,
  PATCH as exchangePATCH,
} from "@system/interface/routes/system.integration-exchanges.$exchangeId"
import {
  GET as reconciliationsGET,
  POST as reconciliationsPOST,
} from "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations"
import {
  GET as exchangesGET,
  POST as exchangesPOST,
} from "@system/interface/routes/system.integration-exchanges"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const accountId = zAccountId.parse("integration-writer")
const scopedAccountId = zAccountId.parse("scoped-integration-writer")
const digestA = "a".repeat(64)
const digestB = "b".repeat(64)

describe("System integration HTTP", () => {
  test("Connector・交換・retry・照合を同じ認可と証跡モデルで実行する", async () => {
    const fixture = new SystemSessionTestContext()
    const clock = { value: new Date() }
    seedAuthorization(fixture, clock.value)
    const stepUpToken = await seedSystemStepUpGrant(fixture, accountId, clock.value)
    const session = await issueSession(fixture, accountId)
    if (session instanceof Error || session.kind === "rejected") return

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => clock.value)
        await next()
      })
      .get("/system/connectors", ...connectorsGET)
      .post("/system/connectors", ...connectorsPOST)
      .patch("/system/connectors/:connectorId", ...connectorPATCH)
      .post("/system/machine-sessions", ...machineSessionPOST)
      .get("/system/integration-exchanges", ...exchangesGET)
      .post("/system/integration-exchanges", ...exchangesPOST)
      .get("/system/integration-exchanges/:exchangeId", ...exchangeGET)
      .patch("/system/integration-exchanges/:exchangeId", ...exchangePATCH)
      .get("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsGET)
      .post("/system/integration-exchanges/:exchangeId/reconciliations", ...reconciliationsPOST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        "x-system-step-up": stepUpToken,
      },
    })

    const connector = await client.system.connectors.$post({ json: connectorInput() })
    expect(connector.status).toBe(201)
    const machineCredential = await seedConnectorMachine(fixture, clock.value)
    const machineLogin = await app.request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(machineCredential),
      },
      {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      },
    )
    expect(machineLogin.status).toBe(201)
    const exchange = await client.system["integration-exchanges"].$post({
      json: exchangeInput("exchange:1"),
    })
    expect(exchange.status).toBe(201)
    const replay = await client.system["integration-exchanges"].$post({
      json: exchangeInput("exchange:replay"),
    })
    expect(replay.status).toBe(200)

    clock.value = new Date(clock.value.getTime() + 1_000)
    const failed = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "exchange:1" },
      json: { status: "failed", external_reference: null, error_code: "remote.unavailable" },
    })
    expect(failed.status).toBe(200)
    clock.value = new Date(clock.value.getTime() + 1_000)
    const retried = await client.system["integration-exchanges"][":exchangeId"].$patch({
      param: { exchangeId: "exchange:1" },
      json: { status: "pending", external_reference: null, error_code: null },
    })
    expect(retried.status).toBe(200)

    const reconciled = await client.system["integration-exchanges"][
      ":exchangeId"
    ].reconciliations.$post({
      param: { exchangeId: "exchange:1" },
      json: {
        id: "reconciliation:1",
        connector_id: "connector:1",
        assertion: {
          id: "assertion:1",
          external_key: "record:1",
          external_version: "1",
          payload_digest: digestB,
          observed_at: new Date(clock.value.getTime() - 1_000).toISOString(),
        },
        local_version: "7",
        items: [{ key: "record:1", local_digest: digestA, external_digest: digestB }],
      },
    })
    expect(reconciled.status).toBe(201)
    const listed = await client.system["integration-exchanges"][":exchangeId"].reconciliations.$get(
      {
        param: { exchangeId: "exchange:1" },
      },
    )
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      reconciliations: [{ status: "mismatched", item_count: 1 }],
    })
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total FROM system_audit_events
           WHERE action IN (
             'system.connector.created',
             'system.integration_exchange.created',
             'system.integration_exchange.failed',
             'system.integration_exchange.pending',
             'system.integration_reconciliation.recorded'
           )`,
        )
        .get(),
    ).toEqual({ total: 5 })

    const scopedSession = await issueSession(fixture, scopedAccountId)
    if (scopedSession instanceof Error || scopedSession.kind === "rejected") return
    const scopedClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${scopedSession.accessToken}` },
    })
    expect(
      (
        await scopedClient.system["integration-exchanges"].$get({
          query: { connector_id: "connector:1" },
        })
      ).status,
    ).toBe(200)
    const denied = await scopedClient.system["integration-exchanges"].$get({
      query: { connector_id: "connector:other" },
    })
    expect(Number(denied.status)).toBe(403)

    clock.value = new Date(clock.value.getTime() + 1_000)
    const disabled = await client.system.connectors[":connectorId"].$patch({
      param: { connectorId: "connector:1" },
      json: {
        name: "Generic",
        status: "disabled",
        expected_revision: 1,
        reason: "maintenance",
      },
    })
    expect(disabled.status).toBe(200)
    const disabledMachineLogin = await app.request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(machineCredential),
      },
      {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        NOW: clock.value.toISOString(),
      },
    )
    expect(Number(disabledMachineLogin.status)).toBe(401)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total FROM system_audit_events
           WHERE action IN ('auth.machine_token.issued', 'system.connector.updated')`,
        )
        .get(),
    ).toEqual({ total: 2 })
  })
})

function seedAuthorization(fixture: SystemSessionTestContext, now: Date): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(scopedAccountId, now.getTime())
  fixture.sqlite.exec(
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('integration-role', 'system:integration', 'managed', 'Integration', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('integration-role', 'integration:read'), ('integration-role', 'integration:write');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('integration-binding', 'integration-writer', 'integration-role', NULL, NULL, 1, NULL);
     INSERT INTO system_iam_roles
       (id, key, kind, resource_type, name, created_at, updated_at)
     VALUES ('scoped-integration-role', 'system:scoped-integration', 'custom',
             'system:connector', 'Scoped integration', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('scoped-integration-role', 'integration:read'),
            ('scoped-integration-role', 'integration:write');
     INSERT INTO system_role_bindings
       (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES ('scoped-integration-binding', 'scoped-integration-writer',
             'scoped-integration-role', 'system:connector', 'connector:1', 1, NULL);`,
  )
}

async function issueSession(
  fixture: SystemSessionTestContext,
  requestedAccountId: typeof accountId,
) {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret: "system-session-test-jwt-secret",
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  return applications.issue.execute({
    accountId: requestedAccountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
}

function connectorInput() {
  return {
    id: "connector:1",
    key: "generic",
    name: "Generic",
    direction: "bidirectional" as const,
    transport: "api" as const,
  }
}

function exchangeInput(id: string) {
  return {
    id,
    connector_id: "connector:1",
    direction: "outbound" as const,
    operation_key: "record.export",
    idempotency_key: "command:1",
    payload_digest: digestA,
  }
}

async function seedConnectorMachine(
  fixture: SystemSessionTestContext,
  now: Date,
): Promise<Readonly<{ credential_id: string; secret: string }>> {
  const secret = "2".repeat(64)
  const secretHash = await new SystemPrincipalSecretService().hashRawSecret(secret)
  if (secretHash instanceof Error) throw secretHash
  fixture.sqlite.exec(
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('connector-machine-account', 'active', 0, ${now.getTime()}, ${now.getTime()});
     INSERT INTO system_principals
       (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
     VALUES ('principal:connector', 'connector-machine-account', 'connector',
             'Connector machine', 'connector:1', 1, ${now.getTime()}, ${now.getTime()});`,
  )
  fixture.sqlite
    .query(
      `INSERT INTO system_machine_credentials
         (id, principal_id, name, secret_hash, status, created_at, updated_at,
          expires_at, last_used_at, revoked_at)
       VALUES ('credential:connector', 'principal:connector', 'Primary', ?1, 'active',
               ?2, ?2, NULL, NULL, NULL)`,
    )
    .run(secretHash, now.getTime())
  return { credential_id: "credential:connector", secret }
}
