import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, { employeeId })
}

describe("GET /company/v1/employees/:employee_id/workforce-state", () => {
  test("returns a self workforce state with its fixed organization revision", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/employees/employee%3A5/workforce-state?as_of=2026-01-01",
      token: await token(5),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      employee_id: "employee:5",
      as_of: "2026-01-01",
      organization_revision: organizationRevision,
      employment_status: "ACTIVE",
      employment_id: "employment:employment-5",
      primary_assignment: {
        organization_unit_id: "department:D003",
        manager_employee_id: "employee:4",
      },
    })
  })

  test("allows the canonical direct manager and conceals an unrelated employee", async () => {
    const db = await createLifecycleRouteDb()
    const path = "/company/v1/employees/employee%3A5/workforce-state?as_of=2026-01-01"
    const manager = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path,
      token: await token(4),
    })
    const unrelated = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path,
      token: await token(6),
    })

    expect(manager.status).toBe(200)
    expect(unrelated.status).toBe(404)
  })

  test("rejects history before the canonical migration baseline", async () => {
    const response = await requestWithContext({
      db: await createLifecycleRouteDb(),
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/employees/employee%3A5/workforce-state?as_of=2024-12-31",
      token: await token(5),
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: "company_as_of_before_baseline" })
  })
})
