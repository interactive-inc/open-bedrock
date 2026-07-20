import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "iam-account-roles-route-test-secret"

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

  await seedIamForEmployees(db)

  return db
}

/** E001 は admin(iam:assign_roles 保有)、E005 は member、account.id = employee.id。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "admin" })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(props: {
  accountId: number
  token: string | null
  body: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: `/accounts/${props.accountId}/roles`,
    token: props.token,
    method: "POST",
    body: props.body,
  })
}

describe("POST /accounts/:id/roles", () => {
  test("admin grants the manager role to a member account", async () => {
    const response = await request({
      accountId: 5,
      token: await adminToken(),
      body: { role_key: "manager" },
    })

    expect(response.status).toBe(204)
  })

  test("rejects self-assignment to prevent escalation", async () => {
    const response = await request({
      accountId: 1,
      token: await adminToken(),
      body: { role_key: "manager" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 403 for a member without iam:assign_roles", async () => {
    const response = await request({
      accountId: 1,
      token: await memberToken(),
      body: { role_key: "manager" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown role key", async () => {
    const response = await request({
      accountId: 5,
      token: await adminToken(),
      body: { role_key: "ghost" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ accountId: 5, token: null, body: { role_key: "manager" } })

    expect(response.status).toBe(401)
  })
})
