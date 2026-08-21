import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "work-style-route-test-secret"

const workStyleResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  style: z.enum(["regular", "flextime", "discretionary", "shift"]),
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

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

  await seedD1(db, "employee_work_styles", [
    {
      id: 1,
      employee_id: 5,
      style: "flextime",
      starts_on: "2026-04-01",
      ends_on: null,
      note: null,
      created_at: "2026-04-01T00:00:00.000Z",
    },
  ])

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /employee-work-styles", () => {
  test("self can read own work styles without any permission", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles?employee_id=5",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(workStyleResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.style).toBe("flextime")
    }
  })

  test("member reading another employee is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles?employee_id=9",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("work_style:read:all can read another employee", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles?employee_id=5",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles?employee_id=5",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /employee-work-styles", () => {
  test("work_style:manage can record a work style", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        employee_id: 5,
        style: "discretionary",
        starts_on: "2026-07-01",
        note: "企画職",
      },
    })

    expect(response.status).toBe(201)

    const parsed = workStyleResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.style).toBe("discretionary")
      expect(parsed.data.starts_on).toBe("2026-07-01")
    }
  })

  test("member without work_style:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { employee_id: 5, style: "flextime", starts_on: "2026-07-01" },
    })

    expect(response.status).toBe(403)
  })

  test("invalid style is rejected", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-work-styles",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_id: 5, style: "remote", starts_on: "2026-07-01" },
    })

    expect(response.status).toBe(400)
  })
})
