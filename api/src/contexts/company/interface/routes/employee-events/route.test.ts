import { describe, expect, test } from "bun:test"
import { seedEmployeeEvents } from "@/contexts/company/infrastructure/seed/seed-employee-events"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const eventResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  kind: z.string(),
  effective_date: z.string(),
  from_department_code: z.string().nullable(),
  to_department_code: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "employee-events-route-test-secret"

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

  await seedD1(
    db,
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "employee_events",
    seedEmployeeEvents.map((event) => ({
      id: event.id,
      employee_id: event.employeeId,
      kind: event.kind,
      effective_date: event.effectiveDate,
      from_department_code: event.fromDepartmentCode,
      to_department_code: event.toDepartmentCode,
      note: event.note,
      created_at: event.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /employee-events", () => {
  test("returns 200 with the viewer's own events by default (desc by effective_date)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(eventResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.map((row) => row.effective_date)).toEqual([
        "2025-10-01",
        "2024-04-01",
      ])
    }
  })

  test("filters own events by kind", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events?kind=transfer",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(eventResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.kind).toBe("transfer")
    }
  })

  test("employee_event:read:all can read another employee's events", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events?employee_id=5",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(eventResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((row) => row.employee_id === 5)).toBe(true)
    }
  })

  test("resolves employee_code to id for read:all viewer", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events?employee_code=E005",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(eventResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((row) => row.employee_id === 5)).toBe(true)
    }
  })

  test("manager without employee_event:read:all cannot read a report's events", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events?employee_id=5",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(403)
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events?employee_id=9",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /employee-events", () => {
  test("employee_event:manage can record an event", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        employee_id: 9,
        kind: "leave_of_absence",
        effective_date: "2026-06-01",
        note: "Parental leave",
      },
    })

    expect(response.status).toBe(201)

    const parsed = eventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(9)
      expect(parsed.data.kind).toBe("leave_of_absence")
    }
  })

  test("member without employee_event:manage is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { employee_id: 5, kind: "transfer", effective_date: "2026-06-01" },
    })

    expect(response.status).toBe(403)
  })

  test("unknown kind is rejected by validation", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_id: 9, kind: "promotion", effective_date: "2026-06-01" },
    })

    expect(response.status).toBe(400)
  })

  test("records an event by employee_code", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        employee_code: "E009",
        kind: "return",
        effective_date: "2026-07-01",
      },
    })

    expect(response.status).toBe(201)

    const parsed = eventResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(9)
    }
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { employee_code: "E999", kind: "transfer", effective_date: "2026-06-01" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when both employee_id and employee_code are given", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        employee_id: 9,
        employee_code: "E009",
        kind: "transfer",
        effective_date: "2026-06-01",
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when neither employee_id nor employee_code is given", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/employee-events",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: { kind: "transfer", effective_date: "2026-06-01" },
    })

    expect(response.status).toBe(400)
  })
})
