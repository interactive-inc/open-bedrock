import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

async function adminToken() {
  return createTestToken(lifecycleRouteJwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

describe("POST /personnel-actions/:id/correct", () => {
  test("appends a correction without exposing the required reason", async () => {
    const db = await createLifecycleRouteDb()
    const token = await adminToken()
    const created = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/personnel-actions",
      method: "POST",
      token,
      headers: { "Idempotency-Key": "position-before-correction" },
      now: "2026-01-01T00:00:00.000Z",
      body: {
        action: {
          kind: "position_changed",
          employeeCode: "E005",
          eventOn: "2026-01-01",
          departmentCode: "D003",
          assignmentType: "primary",
          positionCode: "SENIOR_ENGINEER",
          changeType: "promotion",
        },
        expected_employee_revision: 0,
        expected_organization_revision: 0,
      },
    })
    expect(created.status).toBe(201)
    const originalId = ((await created.json()) as { id: string }).id

    const corrected = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: `/personnel-actions/${originalId}/correct`,
      method: "POST",
      token,
      headers: { "Idempotency-Key": "position-correction-1" },
      now: "2026-01-01T00:00:00.000Z",
      body: {
        event_on: "2026-01-01",
        reason: "Confidential correction reason",
        replacement_action: {
          kind: "position_changed",
          employeeCode: "E005",
          eventOn: "2026-01-01",
          departmentCode: "D003",
          assignmentType: "primary",
          positionCode: "ENGINEER",
          changeType: "promotion",
        },
        expected_employee_revision: 1,
        expected_organization_revision: 1,
      },
    })
    expect(corrected.status).toBe(201)
    const responseText = await corrected.text()
    expect(responseText).toContain("corrected")
    expect(responseText).not.toContain("Confidential correction reason")
    expect(
      await db
        .prepare("SELECT summary_json FROM personnel_actions ORDER BY rowid DESC LIMIT 1")
        .first<string>("summary_json"),
    ).not.toContain("Confidential correction reason")
  })
})
