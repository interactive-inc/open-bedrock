import { createTestToken } from "@/interface/shared/test/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/interface/shared/test/lifecycle-route-fixture"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { describe, expect, test } from "bun:test"

async function token(employeeId: number) {
  return createTestToken(lifecycleRouteJwtSecret, { employeeId })
}

async function retireE5(db: D1Database) {
  const response = await requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/personnel-actions",
    method: "POST",
    token: await token(1),
    headers: { "Idempotency-Key": "retire-e5-before-archive" },
    body: {
      action: { kind: "retired", employeeCode: "E005", retirementOn: "2025-12-31" },
      expected_employee_revision: 0,
      expected_organization_revision: 0,
    },
    now: "2026-01-01T00:00:00.000Z",
  })
  expect(response.status).toBe(201)
}

describe("POST /employees/:code/archive", () => {
  test("preserves history while suspending login and hiding the employee", async () => {
    const db = await createLifecycleRouteDb()
    await retireE5(db)
    await db
      .prepare(
        `INSERT INTO attendance_records
           (employee_id, work_date, clock_in_at, clock_out_at, work_minutes, note, status)
         VALUES (5, '2025-12-01', '2025-12-01T09:00:00Z',
                 '2025-12-01T18:00:00Z', 480, NULL, 'closed')`,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/employees/E005/archive",
      method: "POST",
      token: await token(1),
      now: "2026-01-02T00:00:00.000Z",
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "archived" })
    expect(
      await db
        .prepare("SELECT archived_at IS NOT NULL FROM employees WHERE id = 5")
        .first<number>("archived_at IS NOT NULL"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT status FROM accounts WHERE employee_id = 5").first<string>("status"),
    ).toBe("suspended")
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM attendance_records WHERE employee_id = 5")
        .first<number>("COUNT(*)"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT COUNT(*) FROM personnel_actions WHERE employee_id = 5")
        .first<number>("COUNT(*)"),
    ).toBe(2)
    expect(
      await db
        .prepare("SELECT action FROM audit_logs ORDER BY id DESC LIMIT 1")
        .first<string>("action"),
    ).toBe("employee.archived")
  })

  test("rejects active employees and callers without archive permission", async () => {
    const db = await createLifecycleRouteDb()
    const active = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/employees/E005/archive",
      method: "POST",
      token: await token(1),
    })
    expect(active.status).toBe(409)

    await retireE5(db)
    const forbidden = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/employees/E005/archive",
      method: "POST",
      token: await token(4),
    })
    expect(forbidden.status).toBe(403)
  })
})
