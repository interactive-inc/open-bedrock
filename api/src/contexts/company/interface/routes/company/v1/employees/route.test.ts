import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, { employeeId })
}

describe("GET /company/v1/employees", () => {
  test("returns opaque Employee profiles in requested order with explicit missing IDs", async () => {
    const response = await requestWithContext({
      db: await createLifecycleRouteDb(),
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/employees?employee_id=employee%3A5&employee_id=employee%3A404",
      token: await token(1),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      employees: [
        {
          employee_id: "employee:5",
          official_name: "Emery Lane",
          employee_code: "E005",
          email: null,
          phone: null,
        },
      ],
      missing_employee_ids: ["employee:404"],
    })
  })

  test("requires the explicit all-workforce read permission", async () => {
    const response = await requestWithContext({
      db: await createLifecycleRouteDb(),
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/employees?employee_id=employee%3A5",
      token: await token(5),
    })

    expect(response.status).toBe(403)
  })
})
