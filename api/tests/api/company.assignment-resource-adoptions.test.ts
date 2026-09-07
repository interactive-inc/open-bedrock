import { expect, test } from "bun:test"
import { z } from "zod"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"

test("所属移行の実APIは認証・Company管理資格と移行前提を検査する", async () => {
  const f = await createEmployeeAdoptionFixture()
  await initializeStandardCompanyTestState(f.database)
  const jwtSecret = "assignment-adoption-route-test-secret"
  const admin = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const member = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
  const get = (token: string | null) =>
    requestWithContext({
      db: f.database,
      jwtSecret,
      now: f.clock.now.toISOString(),
      token,
      method: "GET",
      path: "/company/assignment-resource-adoptions?employee_id=employee:adoption",
    })
  expect((await get(null)).status).toBe(401)
  expect((await get(member)).status).toBe(403)
  const response = await get(admin)
  expect(response.status).toBe(200)
  const preview = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await response.json())
  const post = (token: string | null) =>
    requestWithContext({
      db: f.database,
      jwtSecret,
      now: f.clock.now.toISOString(),
      token,
      method: "POST",
      path: "/company/assignment-resource-adoptions",
      headers: { "idempotency-key": "root-assignment-adoption" },
      body: {
        ...preview,
        employeeId: "employee:adoption",
        reason: "Confirm original assignment history",
      },
    })
  expect((await post(null)).status).toBe(401)
  expect((await post(member)).status).toBe(403)
  const rejected = await post(admin)
  expect(rejected.status).toBe(422)
  expect(await rejected.json()).toMatchObject({ code: "invalid_assignment_adoption" })
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM company_assignment_resource_adoptions")
      .first<number>("total"),
  ).toBe(0)
})
