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

const jwtSecret = "shift-assignment-crud-test-secret"

const shiftAssignmentResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  pattern_id: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
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

describe("GET /shift-assignments/:id", () => {
  test("privileged role reads an assignment and returns 200", async () => {
    const response = await request({
      path: "/shift-assignments/1",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-assignments/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift-assignments/9999",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift-assignments/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /shift-assignments/:id", () => {
  test("privileged role updates pattern, date and note and returns 200", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: "Updated" },
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.pattern_id).toBe(2)
      expect(parsed.data.date).toBe("2026-06-10")
      expect(parsed.data.note).toBe("Updated")
    }
  })

  test("clears the pattern when pattern_code is null", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { pattern_code: null, date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(200)

    const parsed = shiftAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.pattern_id).toBe(null)
    }
  })

  test("returns 404 for an unknown pattern code", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { pattern_code: "UNKNOWN", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift-assignments/9999",
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift-assignments/:id", () => {
  test("privileged role deletes an assignment and returns 204", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift-assignments/9999",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift-assignments/2",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
