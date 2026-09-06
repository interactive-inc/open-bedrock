import { describe, expect, test } from "bun:test"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "employee-adoption-route-test-secret"

describe("employee adoption at the authenticated API root", () => {
  test("認証・Company管理資格の合成を通して参照・保存・再送する", async () => {
    const f = await createEmployeeAdoptionFixture()
    await initializeStandardCompanyTestState(f.database)
    const admin = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const member = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
    const input = await f.input()
    const request = (token: string | null, method: "GET" | "POST") =>
      requestWithContext({
        db: f.database,
        jwtSecret,
        now: f.clock.now.toISOString(),
        token,
        method,
        path:
          "/company/employee-resource-adoptions" +
          (method === "GET" ? "?employee_id=employee:adoption" : ""),
        ...(method === "POST"
          ? { body: input, headers: { "idempotency-key": "root-adoption" } }
          : {}),
      })
    expect((await request(null, "GET")).status).toBe(401)
    expect((await request(member, "GET")).status).toBe(403)
    expect((await request(member, "POST")).status).toBe(403)
    expect((await request(admin, "GET")).status).toBe(200)
    expect((await request(admin, "POST")).status).toBe(200)
    expect(await (await request(admin, "POST")).json()).toMatchObject({ replayed: true })
  })
})
