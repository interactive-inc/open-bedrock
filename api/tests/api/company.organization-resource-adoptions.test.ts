import { expect, test } from "bun:test"
import { z } from "zod"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
const jwtSecret = "organization-adoption-route-test-secret"

test("実APIの認証とCompany管理資格を通して組織の履歴を接続・再送する", async () => {
  const f = await createEmployeeAdoptionFixture()
  await initializeStandardCompanyTestState(f.database)
  const admin = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const member = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
  const root = await f.database
    .prepare(
      "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ id: string }>()
  if (root === null) throw new Error("root missing")
  const get = (token: string | null) =>
    requestWithContext({
      db: f.database,
      jwtSecret,
      now: f.clock.now.toISOString(),
      token,
      method: "GET",
      path: `/company/organization-resource-adoptions?organization_unit_id=${encodeURIComponent(root.id)}`,
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
      path: "/company/organization-resource-adoptions",
      headers: { "idempotency-key": "root-organization-adoption" },
      body: { ...preview, organizationUnitId: root.id, reason: "Confirmed root history" },
    })
  expect((await post(null)).status).toBe(401)
  expect((await post(member)).status).toBe(403)
  expect((await post(admin)).status).toBe(201)
  const replay = await post(admin)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toMatchObject({ replayed: true, organizationUnitId: root.id })
})
