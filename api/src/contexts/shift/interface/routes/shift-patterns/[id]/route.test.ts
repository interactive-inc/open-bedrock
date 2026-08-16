import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedShiftAssignments } from "@/contexts/shift/infrastructure/seed/seed-shift-assignments"
import { seedShiftPatterns } from "@/contexts/shift/infrastructure/seed/seed-shift-patterns"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "shift-pattern-crud-test-secret"

const shiftPatternResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_minutes: z.number(),
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

  await seedD1(
    db,
    "shift_patterns",
    seedShiftPatterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    })),
  )

  await seedD1(
    db,
    "shift_assignments",
    seedShiftAssignments.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employeeId,
      pattern_id: assignment.patternId,
      date: assignment.date,
      note: assignment.note,
      published_at: assignment.publishedAt,
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

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /shift-patterns/:id", () => {
  test("privileged role reads a pattern and returns 200", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = shiftPatternResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("EARLY")
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown pattern", async () => {
    const response = await request({
      path: "/shift-patterns/9999",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift-patterns/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /shift-patterns/:id", () => {
  test("privileged role updates a pattern and returns 200", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: {
        code: "EARLY",
        name: "Early shift",
        start_time: "06:30",
        end_time: "15:30",
        break_minutes: 45,
      },
    })

    expect(response.status).toBe(200)

    const parsed = shiftPatternResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Early shift")
      expect(parsed.data.start_time).toBe("06:30")
      expect(parsed.data.break_minutes).toBe(45)
    }
  })

  test("returns 409 when renaming to an existing code", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: {
        code: "LATE",
        name: "Early",
        start_time: "07:00",
        end_time: "16:00",
        break_minutes: 60,
      },
    })

    expect(response.status).toBe(409)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: {
        code: "EARLY",
        name: "Early",
        start_time: "07:00",
        end_time: "16:00",
        break_minutes: 60,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown pattern", async () => {
    const response = await request({
      path: "/shift-patterns/9999",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: {
        code: "ZZZZ",
        name: "Z",
        start_time: "07:00",
        end_time: "16:00",
        break_minutes: 60,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift-patterns/:id", () => {
  test("deletes an unreferenced pattern and returns 204", async () => {
    const response = await request({
      path: "/shift-patterns/3",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 409 for a pattern referenced by assignments", async () => {
    const response = await request({
      path: "/shift-patterns/1",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-patterns/3",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown pattern", async () => {
    const response = await request({
      path: "/shift-patterns/9999",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })
})
