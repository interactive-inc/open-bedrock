import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

const action = {
  kind: "position_changed",
  employeeCode: "E005",
  eventOn: "2026-01-01",
  departmentCode: "D003",
  assignmentType: "primary",
  positionCode: "SENIOR_ENGINEER",
  changeType: "promotion",
}

async function token(employeeId: number, role: string) {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("POST /personnel-actions", () => {
  test("applies once and returns 200 for an identical idempotent replay", async () => {
    const db = await createLifecycleRouteDb()
    const admin = await token(1, "root")
    const body = {
      action,
      expected_employee_revision: 0,
      expected_organization_revision: await readOrganizationRevision(db),
    }
    const props = {
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-actions",
      method: "POST",
      token: admin,
      body,
      headers: { "Idempotency-Key": "direct-position-change-1" },
      now: "2026-01-01T00:00:00.000Z",
    }
    const created = await requestWithContext(props)
    expect(created.status).toBe(201)
    expect(created.headers.get("Cache-Control")).toBe("no-store")
    expect(await created.json()).toMatchObject({
      kind: "position_changed",
      replayed: false,
      summary: { positionTitle: "シニアエンジニア" },
    })
    const replayed = await requestWithContext(props)
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ replayed: true })
    expect(
      await db.prepare("SELECT COUNT(*) AS total FROM personnel_actions").first<number>("total"),
    ).toBe(2)
  })

  test("requires permission and an idempotency key and records permission denial", async () => {
    const db = await createLifecycleRouteDb()
    const denied = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-actions",
      method: "POST",
      token: await token(5, "member"),
      body: {
        action,
        expected_employee_revision: 0,
        expected_organization_revision: await readOrganizationRevision(db),
      },
      headers: { "Idempotency-Key": "member-denied-1" },
    })
    expect(denied.status).toBe(403)
    expect(
      await db
        .prepare("SELECT action FROM audit_events ORDER BY id DESC LIMIT 1")
        .first<string>("action"),
    ).toBe("employee.lifecycle.denied")

    const missingKeyDb = await createLifecycleRouteDb()
    const missingKey = await requestWithContext({
      db: missingKeyDb,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-actions",
      method: "POST",
      token: await token(1, "root"),
      body: {
        action,
        expected_employee_revision: 0,
        expected_organization_revision: await readOrganizationRevision(missingKeyDb),
      },
    })
    expect(missingKey.status).toBe(400)
  })

  test("rejects an unknown position code with 422", async () => {
    const response = await requestWithContext({
      db: await createLifecycleRouteDb(),
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-actions",
      method: "POST",
      token: await token(1, "root"),
      body: {
        action: { ...action, positionCode: "NO_SUCH_POSITION" },
        expected_employee_revision: 0,
        expected_organization_revision: 0,
      },
      headers: { "Idempotency-Key": "unknown-position-1" },
      now: "2026-01-01T00:00:00.000Z",
    })
    expect(response.status).toBe(422)
  })
})
