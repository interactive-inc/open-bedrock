import { createTestToken } from "@/interface/test-helpers/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/interface/test-helpers/lifecycle-route-fixture"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { describe, expect, test } from "bun:test"

function token(employeeId: number, role: string) {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

async function request(db: D1Database, employeeId: number, role: string, path: string) {
  return requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path,
    token: await token(employeeId, role),
    now: "2026-01-01T00:00:00.000Z",
  })
}

describe("GET /employees/:code/lifecycle-events", () => {
  test("allows self, current manager, and read-all while auditing the successful scope", async () => {
    const cases = [
      [5, "member", "employee.lifecycle.read"],
      [4, "manager", "employee.lifecycle.read"],
      [1, "root", "employee.lifecycle.read_all"],
    ] as const
    for (const [employeeId, role, auditAction] of cases) {
      const db = await createLifecycleRouteDb()
      const response = await request(db, employeeId, role, "/employees/E005/lifecycle-events")
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(await response.json()).toMatchObject({
        data: [
          {
            kind: "legacy_baseline",
            display_status: "migration",
            event_on: "2025-01-01",
          },
        ],
        next_cursor: null,
      })
      expect(
        await db
          .prepare("SELECT action FROM audit_events ORDER BY id DESC LIMIT 1")
          .first<string>("action"),
      ).toBe(auditAction)
    }
  })

  test("conceals the employee from an unrelated user and records the denial", async () => {
    const db = await createLifecycleRouteDb()
    const response = await request(db, 6, "member", "/employees/E005/lifecycle-events")
    expect(response.status).toBe(404)
    expect(
      await db
        .prepare("SELECT action FROM audit_events ORDER BY id DESC LIMIT 1")
        .first<string>("action"),
    ).toBe("employee.lifecycle.denied")
  })

  test("rejects a malformed cursor without exposing database details", async () => {
    const db = await createLifecycleRouteDb()
    const response = await request(
      db,
      5,
      "member",
      "/employees/E005/lifecycle-events?cursor=not-a-cursor",
    )
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toContain("invalid_lifecycle_cursor")
    expect(text).not.toContain("SELECT")
    expect(text).not.toContain("personnel_actions")
  })
})
