import { describe, expect, test } from "bun:test"
import type { AuditEventRecord } from "@/contexts/company/application/audit/company-audit-event"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { ValidationError } from "@/lib/errors"

const decisionId = "00000000-0000-4000-8000-000000000041"

function record(eventId: string, overrides: Partial<AuditEventRecord> = {}): AuditEventRecord {
  return {
    eventId,
    requestId: "00000000-0000-4000-8000-000000000001",
    actorAccountId: 7,
    actorEmployeeId: 11,
    action: "auth.session.refreshed",
    targetType: "account",
    targetId: "7",
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: '{"family_id_hash":"family-hash"}',
    clientIp: "192.0.2.7",
    clientName: "api",
    createdAt: 1_700_000_000,
    ...overrides,
  }
}

function cases() {
  return [
    { decision: "rotated", record: record("event-rotated") },
    {
      decision: "reused",
      record: record("event-reused", {
        actorAccountId: null,
        actorEmployeeId: null,
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reasonCode: "refresh_token_reuse",
      }),
    },
    {
      decision: "invalid",
      record: record("event-invalid", {
        actorAccountId: null,
        actorEmployeeId: null,
        outcome: "denied",
        reasonCode: "invalid_token",
      }),
    },
  ] as const
}

async function appendDecision(
  db: D1Database,
  repository: AuditEventRepository,
  decision: string,
): Promise<void> {
  const fragment = repository.prepareExclusiveAppend({ decisionId, cases: cases() })

  await db.batch([
    db
      .prepare(
        `INSERT INTO audit_batch_decisions (decision_id, decision_value)
         VALUES (?1, ?2)`,
      )
      .bind(decisionId, decision),
    ...fragment.statements,
  ])
}

async function markerCount(db: D1Database): Promise<number | null> {
  return db.prepare("SELECT COUNT(*) AS count FROM audit_batch_decisions").first<number>("count")
}

function expectInvalidFragment(callback: () => unknown): void {
  try {
    callback()
    throw new Error("expected invalid exclusive append fragment")
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).code).toBe("audit_invalid_decision_fragment")
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }

  throw new Error("expected rejection")
}

describe("AuditEventRepository exclusive append fragment", () => {
  test.each(["rotated", "reused", "invalid"] as const)(
    "appends only the %s event and removes its transaction marker",
    async (decision) => {
      const { context, db } = createTestContext()
      const repository = new AuditEventRepository(context)

      await appendDecision(db, repository, decision)

      expect(
        (
          await db
            .prepare("SELECT event_id FROM audit_events ORDER BY event_id")
            .all<{ event_id: string }>()
        ).results,
      ).toEqual([{ event_id: `event-${decision}` }])
      expect(await markerCount(db)).toBe(0)
    },
  )

  test("rejects duplicate decisions and duplicate candidate event IDs", () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    const valid = cases()

    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({
        decisionId,
        cases: [valid[0], { ...valid[1], decision: "rotated" }, valid[2]],
      }),
    )
    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({
        decisionId,
        cases: [valid[0], { ...valid[1], record: record("event-rotated") }, valid[2]],
      }),
    )
  })

  test("rejects an invalid decision id, case count, and decision byte length", () => {
    const { context } = createTestContext()
    const repository = new AuditEventRepository(context)
    const valid = cases()

    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({ decisionId: "not-a-uuid", cases: valid }),
    )
    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({ decisionId, cases: [valid[0]] as never }),
    )
    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({
        decisionId,
        cases: [...valid, ...valid, ...valid] as never,
      }),
    )
    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({
        decisionId,
        cases: [{ ...valid[0], decision: "" }, valid[1], valid[2]],
      }),
    )
    expectInvalidFragment(() =>
      repository.prepareExclusiveAppend({
        decisionId,
        cases: [{ ...valid[0], decision: "界".repeat(22) }, valid[1], valid[2]],
      }),
    )
  })

  test("rejects an unknown marker and rolls the marker back", async () => {
    const { context, db } = createTestContext()
    const repository = new AuditEventRepository(context)

    const error = await rejectionOf(appendDecision(db, repository, "missing"))
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("malformed JSON")
    expect(await markerCount(db)).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
  })

  test.each(["ABORT", "IGNORE"] as const)(
    "rolls back the whole batch when the selected audit insert raises %s",
    async (raise) => {
      const { context, db } = createTestContext()
      const repository = new AuditEventRepository(context)
      await db.exec(`
        CREATE TRIGGER reject_selected_audit_insert
        BEFORE INSERT ON audit_events
        WHEN NEW.event_id = 'event-rotated'
        BEGIN
          SELECT RAISE(${raise}${raise === "ABORT" ? ", 'forced audit failure'" : ""});
        END;
      `)
      const fragment = repository.prepareExclusiveAppend({ decisionId, cases: cases() })

      expect(
        db.batch([
          db
            .prepare(
              `INSERT INTO audit_batch_decisions (decision_id, decision_value)
               VALUES (?1, 'rotated')`,
            )
            .bind(decisionId),
          db
            .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?2, 0, 0)")
            .bind("transaction-role", "Transaction role"),
          ...fragment.statements,
        ]),
      ).rejects.toThrow()

      expect(await markerCount(db)).toBe(0)
      expect(
        await db
          .prepare("SELECT COUNT(*) AS count FROM roles WHERE key = 'transaction-role'")
          .first<number>("count"),
      ).toBe(0)
      expect(
        await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
      ).toBe(0)
    },
  )

  test("binds decision and event values instead of interpolating them into SQL", () => {
    const { context, db } = createTestContext()
    const preparedSql: string[] = []
    context.env.DB = new Proxy(db, {
      get(target, property, receiver) {
        if (property === "prepare") {
          return (sql: string) => {
            preparedSql.push(sql)
            return target.prepare(sql)
          }
        }

        return Reflect.get(target, property, receiver)
      },
    })
    const repository = new AuditEventRepository(context)
    const injectionDecision = "rotated'); SELECT 1; --"
    const injectionEventId = "event'); SELECT 1; --"

    repository.prepareExclusiveAppend({
      decisionId,
      cases: [{ decision: injectionDecision, record: record(injectionEventId) }, cases()[1]],
    })

    expect(preparedSql.join("\n")).not.toContain(injectionDecision)
    expect(preparedSql.join("\n")).not.toContain(injectionEventId)
  })
})
