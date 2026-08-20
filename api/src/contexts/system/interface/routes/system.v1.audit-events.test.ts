import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { GET as GET_ONE } from "@system/interface/routes/system.v1.audit-events.$eventId"
import { GET as GET_MANY } from "@system/interface/routes/system.v1.audit-events"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-02T00:00:00.000Z")
const occurredAt = new Date("2026-01-01T00:00:00.000Z")
const readerAccountId = zAccountId.parse("system-audit-reader")
const deniedAccountId = zAccountId.parse("system-audit-denied")

describe("System Audit HTTP", () => {
  test("System IAMでreadを制御し、成功・拒否を同じappend-only台帳へ自己監査する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3), (?2, 'active', 0, ?3, ?3)`,
      )
      .run(readerAccountId, deniedAccountId, occurredAt.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_roles
           (id, key, kind, name, created_at, updated_at)
         VALUES ('audit-reader', 'system:audit-reader', 'managed', 'Audit reader', ?1, ?1)`,
      )
      .run(occurredAt.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('audit-reader', 'audit:read')`,
      )
      .run()
    fixture.sqlite
      .query(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('audit-binding', ?1, 'audit-reader', NULL, NULL, ?2, NULL)`,
      )
      .run(readerAccountId, occurredAt.getTime())

    const seedEvent = createSystemAuditEvent({
      actorAccountId: readerAccountId,
      action: "system.session.issued",
      targetType: "system:session",
      targetId: "session-1",
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt,
    })
    expect(seedEvent).not.toBeInstanceOf(Error)
    if (seedEvent instanceof Error) return
    expect(await new SystemAuditEventRepository(fixture.context).append(seedEvent)).toBeUndefined()

    const applications = createSystemSessionApplications({
      context: fixture.context,
      jwtSecret: "system-session-test-jwt-secret",
      sessionTtlMilliseconds: 604_800_000,
    })
    expect(applications).not.toBeInstanceOf(Error)
    if (applications instanceof Error) return
    const readerSession = await applications.issue.execute({
      accountId: readerAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    const deniedSession = await applications.issue.execute({
      accountId: deniedAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(readerSession).not.toBeInstanceOf(Error)
    expect(deniedSession).not.toBeInstanceOf(Error)
    if (
      readerSession instanceof Error ||
      readerSession.kind === "rejected" ||
      deniedSession instanceof Error ||
      deniedSession.kind === "rejected"
    ) {
      return
    }

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/v1/audit-events", ...GET_MANY)
      .get("/system/v1/audit-events/:eventId", ...GET_ONE)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
      })
    const reader = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${readerSession.accessToken}` },
    })
    const denied = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${deniedSession.accessToken}` },
    })

    const listed = await reader.system.v1["audit-events"].$get({ query: {} })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("events" in listedBody).toBe(true)
    if (!("events" in listedBody)) return
    expect(listedBody.total).toBe(3)
    expect(listedBody.events.some((event) => event.event_id === seedEvent.eventId)).toBe(true)

    const detailed = await reader.system.v1["audit-events"][":eventId"].$get({
      param: { eventId: seedEvent.eventId },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({
      event_id: seedEvent.eventId,
      action: "system.session.issued",
    })

    const forbidden = await denied.system.v1["audit-events"].$get({ query: {} })
    expect(Number(forbidden.status)).toBe(403)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action = 'system.audit.list' AND outcome = 'denied'`,
        )
        .get() as { total: number },
    ).toEqual({ total: 1 })
  })
})
