import { app } from "@/app"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "delegation-route-test-secret"

async function setup() {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      status: employee.status,
    })),
  )
  await seedIamForEmployees(db)
  return db
}

function token(employeeId: number, role = "member") {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

async function request(
  db: D1Database,
  employeeId: number,
  method: "GET" | "POST" | "DELETE",
  path = "/approval-delegations",
  body?: unknown,
) {
  return app.request(
    path,
    {
      method,
      headers: {
        Authorization: `Bearer ${await token(employeeId)}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { DB: db, JWT_SECRET: jwtSecret, NOW: "2026-01-01T00:00:00.000Z" },
  )
}

const body = {
  delegate_employee_code: "E006",
  template_code: null,
  starts_at: "2026-01-01T00:00:00.000Z",
  ends_at: "2026-01-31T00:00:00.000Z",
}

describe("approval delegation routes", () => {
  test("creates, lists and lets only the delegator delete a delegation", async () => {
    const db = await setup()
    const created = await request(db, 5, "POST", "/approval-delegations", body)
    expect(created.status).toBe(201)
    const id = ((await created.json()) as { id: number }).id
    const listed = await request(db, 5, "GET")
    expect(((await listed.json()) as { data: Array<unknown> }).data).toHaveLength(1)
    expect((await request(db, 6, "DELETE", `/approval-delegations/${id}`)).status).toBe(403)
    expect((await request(db, 5, "DELETE", `/approval-delegations/${id}`)).status).toBe(204)
  })

  test("rejects self delegation and overlapping periods", async () => {
    const db = await setup()
    expect(
      (
        await request(db, 5, "POST", "/approval-delegations", {
          ...body,
          delegate_employee_code: "E005",
        })
      ).status,
    ).toBe(400)
    expect((await request(db, 5, "POST", "/approval-delegations", body)).status).toBe(201)
    expect((await request(db, 5, "POST", "/approval-delegations", body)).status).toBe(409)
  })
})
