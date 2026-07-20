import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftAssignments } from "@/infrastructure/seed/seed-shift-assignments"
import { seedShiftPatterns } from "@/infrastructure/seed/seed-shift-patterns"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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

describe("GET /shift/assignments/:id", () => {
  test("privileged role reads an assignment and returns 200", async () => {
    const response = await request({
      path: "/shift/assignments/1",
      token: await tokenFor(1, "admin"),
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
      path: "/shift/assignments/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/assignments/9999",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift/assignments/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /shift/assignments/:id", () => {
  test("privileged role updates pattern, date and note and returns 200", async () => {
    const response = await request({
      path: "/shift/assignments/2",
      token: await tokenFor(1, "admin"),
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
      path: "/shift/assignments/2",
      token: await tokenFor(1, "admin"),
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
      path: "/shift/assignments/2",
      token: await tokenFor(1, "admin"),
      method: "PUT",
      body: { pattern_code: "UNKNOWN", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/assignments/2",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/assignments/9999",
      token: await tokenFor(1, "admin"),
      method: "PUT",
      body: { pattern_code: "LATE", date: "2026-06-10", note: null },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift/assignments/:id", () => {
  test("privileged role deletes an assignment and returns 204", async () => {
    const response = await request({
      path: "/shift/assignments/2",
      token: await tokenFor(1, "admin"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/assignments/2",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/shift/assignments/9999",
      token: await tokenFor(1, "admin"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/assignments/2",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
