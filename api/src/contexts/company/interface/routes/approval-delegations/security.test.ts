import { app } from "@/api/app"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "delegation-security-test-secret"

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
  await seedD1(db, "application_templates", [
    {
      id: 101,
      code: "template_a",
      name: "Template A",
      category: "general",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
    {
      id: 102,
      code: "template_b",
      name: "Template B",
      category: "general",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
  ])
  return db
}

function token(employeeId: number) {
  return createTestToken(jwtSecret, { employeeId })
}

async function request(
  db: D1Database,
  delegateEmployeeCode: string,
  templateCode: string | null,
  startsAt = "2026-01-01T00:00:00.000Z",
  endsAt = "2026-01-31T00:00:00.000Z",
) {
  return app.request(
    "/approval-delegations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token(5)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        delegate_employee_code: delegateEmployeeCode,
        template_code: templateCode,
        starts_at: startsAt,
        ends_at: endsAt,
      }),
    },
    {
      DB: db,
      JWT_SECRET: jwtSecret,
      AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  )
}

function pauseOverlapReadsUntilBothArrive(db: D1Database): D1Database {
  let arrivals = 0
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const wrapStatement = (statement: D1PreparedStatement, query: string): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property, receiver) {
        if (property === "bind") {
          return (...values: Array<unknown>) => wrapStatement(target.bind(...values), query)
        }
        const pausesOverlapRead =
          query.trimStart().toLowerCase().startsWith("select") &&
          query.includes("approval_delegations")
        if (property === "all" && pausesOverlapRead) {
          return async () => {
            arrivals += 1
            if (arrivals === 2) release?.()
            await gate
            return target.all()
          }
        }
        if (property === "raw" && pausesOverlapRead) {
          return async () => {
            arrivals += 1
            if (arrivals === 2) release?.()
            await gate
            return target.raw()
          }
        }

        return Reflect.get(target, property, receiver)
      },
    })

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) => wrapStatement(target.prepare(query), query)
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

describe("approval delegation conflict security", () => {
  test("rejects a template delegation that overlaps a global delegation", async () => {
    const db = await setup()

    expect((await request(db, "E006", null)).status).toBe(201)
    expect((await request(db, "E009", "template_a")).status).toBe(409)
  })

  test("rejects a global delegation that overlaps a template delegation", async () => {
    const db = await setup()

    expect((await request(db, "E006", "template_a")).status).toBe(201)
    expect((await request(db, "E009", null)).status).toBe(409)
  })

  test("allows overlapping periods for different non-global templates", async () => {
    const db = await setup()

    expect((await request(db, "E006", "template_a")).status).toBe(201)
    expect((await request(db, "E009", "template_b")).status).toBe(201)
  })

  test("treats adjacent delegation periods as non-overlapping", async () => {
    const db = await setup()

    expect(
      (await request(db, "E006", null, "2026-01-01T00:00:00.000Z", "2026-01-15T00:00:00.000Z"))
        .status,
    ).toBe(201)
    expect(
      (await request(db, "E009", null, "2026-01-15T00:00:00.000Z", "2026-01-31T00:00:00.000Z"))
        .status,
    ).toBe(201)
  })

  test("atomically rejects one of two concurrent overlapping delegations", async () => {
    const rawDb = await setup()
    const db = pauseOverlapReadsUntilBothArrive(rawDb)

    const responses = await Promise.all([
      request(db, "E006", "template_a"),
      request(db, "E009", "template_a"),
    ])
    const total = await rawDb
      .prepare("SELECT COUNT(*) AS total FROM approval_delegations")
      .first<number>("total")

    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409])
    expect(total).toBe(1)
  })
})
