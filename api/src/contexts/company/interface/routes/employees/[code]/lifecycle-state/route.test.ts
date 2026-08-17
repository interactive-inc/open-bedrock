import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

describe("GET /employees/:code/lifecycle-state", () => {
  test("returns the strict as-of state and revisions", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/employees/E005/lifecycle-state?as_of=2026-01-01",
      token: await createTestToken(lifecycleRouteJwtSecret, {
        employeeId: 5,
        email: "you+e005@example.com",
        role: "member",
      }),
      now: "2026-01-01T00:00:00.000Z",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toMatchObject({
      employee_code: "E005",
      as_of: "2026-01-01",
      status: "active",
      archived: false,
      employee_revision: 0,
      organization_revision: organizationRevision,
      primary_assignment: {
        department_code: "D003",
        department_name: "開発部",
        manager_employee_code: "E004",
      },
    })
  })

  test("rejects an invalid calendar date", async () => {
    const db = await createLifecycleRouteDb()
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/employees/E005/lifecycle-state?as_of=2026-02-30",
      token: await createTestToken(lifecycleRouteJwtSecret, {
        employeeId: 5,
        email: "you+e005@example.com",
        role: "member",
      }),
    })
    expect(response.status).toBe(400)
  })
})
