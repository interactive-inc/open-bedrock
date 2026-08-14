import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedCertificateRequests } from "@/contexts/company/infrastructure/seed/seed-certificate-requests"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "certificate-request-issue-route-test-secret"

const seedId = "20000000-0000-0000-0000-000000000001"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
    { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
  ])

  await seedD1(
    db,
    "certificate_requests",
    seedCertificateRequests.map((certificateRequest) => ({
      id: certificateRequest.id,
      requester_id: certificateRequest.requesterId,
      certificate_type: certificateRequest.certificateType,
      submit_to: certificateRequest.submitTo,
      needed_by: certificateRequest.neededBy,
      note: certificateRequest.note,
      status: certificateRequest.status,
      created_at: certificateRequest.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

describe("POST /certificate-requests/:id/issue", () => {
  test("returns 200 and issues the request for hr", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/certificate-requests/${seedId}/issue`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("issued")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/certificate-requests/${seedId}/issue`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when re-issuing an already-issued request", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/certificate-requests/${seedId}/issue`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/certificate-requests/${seedId}/issue`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("returns 404 when the request does not exist", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/certificate-requests/99999999-0000-0000-0000-000000000000/issue",
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/certificate-requests/${seedId}/issue`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
