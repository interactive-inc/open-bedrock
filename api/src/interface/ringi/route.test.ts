import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedRingiRequests } from "@/infrastructure/seed/seed-ringi-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const statusEnum = z.enum(["pending", "approved", "rejected"])

const ringiResponseSchema = z.object({
  id: z.number(),
  applicant_id: z.number(),
  approver_id: z.number(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: statusEnum,
  decided_at: z.string().nullable(),
  decision_comment: z.string().nullable(),
  created_at: z.string(),
})

const decisionResponseSchema = z.object({
  status: statusEnum,
})

const jwtSecret = "ringi-route-test-secret"

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
    "ringi_requests",
    seedRingiRequests.map((ringi) => ({
      id: ringi.id,
      applicant_id: ringi.applicantId,
      approver_id: ringi.approverId,
      title: ringi.title,
      amount: ringi.amount,
      reason: ringi.reason,
      status: ringi.status,
      decided_at: ringi.decidedAt,
      decision_comment: ringi.decisionComment,
      created_at: ringi.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /ringi", () => {
  test("returns 201 with a pending ringi from the token employee", async () => {
    const response = await request({
      path: "/ringi",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { approver_id: 4, title: "Office chairs", amount: 90000, reason: "ergonomics" },
    })

    expect(response.status).toBe(201)

    const parsed = ringiResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.applicant_id).toBe(5)
      expect(parsed.data.approver_id).toBe(4)
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.decided_at).toBeNull()
    }
  })

  test("returns 401 without a token", async () => {
    const response = await request({
      path: "/ringi",
      token: null,
      method: "POST",
      body: { approver_id: 4, title: "x", amount: 1, reason: "y" },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when approver does not exist", async () => {
    const response = await request({
      path: "/ringi",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { approver_id: 9999, title: "x", amount: 1, reason: "y" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when approver is the applicant", async () => {
    const response = await request({
      path: "/ringi",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { approver_id: 5, title: "x", amount: 1, reason: "y" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount is not a positive integer", async () => {
    const response = await request({
      path: "/ringi",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { approver_id: 4, title: "x", amount: -1, reason: "y" },
    })

    expect(response.status).toBe(400)
  })
})

describe("GET /ringi/me", () => {
  test("returns only the applicant's own ringi", async () => {
    const response = await request({
      path: "/ringi/me",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(2)
    expect(body.data.every((item) => [1, 2].includes(item.id))).toBe(true)
  })

  test("filters by status", async () => {
    const response = await request({
      path: "/ringi/me?status=approved",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(1)
    expect(body.data.at(0)?.id).toBe(2)
  })

  test("returns 401 without a token", async () => {
    const response = await request({ path: "/ringi/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /ringi/inbox", () => {
  test("returns only pending ringi where the token employee is approver", async () => {
    const response = await request({
      path: "/ringi/inbox",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(1)
    expect(body.data.at(0)?.id).toBe(1)
  })

  test("returns empty for an employee who approves nothing pending", async () => {
    const response = await request({
      path: "/ringi/inbox",
      token: await tokenFor(6, "member"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { total: number }

    expect(body.total).toBe(0)
  })

  test("returns 401 without a token", async () => {
    const response = await request({ path: "/ringi/inbox", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /ringi/:id/approve", () => {
  test("returns 200 and flips status to approved for the named approver", async () => {
    const response = await request({
      path: "/ringi/1/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "ok" },
    })

    expect(response.status).toBe(200)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }
  })

  test("returns 200 without a comment (comment optional)", async () => {
    const response = await request({
      path: "/ringi/1/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 when the token employee is not the named approver", async () => {
    const response = await request({
      path: "/ringi/1/approve",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { comment: "ok" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when the ringi is already decided", async () => {
    const response = await request({
      path: "/ringi/2/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "ok" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing ringi", async () => {
    const response = await request({
      path: "/ringi/9999/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "ok" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a token", async () => {
    const response = await request({
      path: "/ringi/1/approve",
      token: null,
      method: "POST",
      body: { comment: "ok" },
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /ringi/:id/reject", () => {
  test("returns 200 and flips status to rejected for the named approver", async () => {
    const response = await request({
      path: "/ringi/1/reject",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "over budget" },
    })

    expect(response.status).toBe(200)

    const parsed = decisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("rejected")
    }
  })

  test("returns 403 when the token employee is not the named approver", async () => {
    const response = await request({
      path: "/ringi/1/reject",
      token: await tokenFor(9, "member"),
      method: "POST",
      body: { comment: "no" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when the ringi is already decided", async () => {
    const response = await request({
      path: "/ringi/2/reject",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "no" },
    })

    expect(response.status).toBe(409)
  })
})

describe("GET /ringi/admin", () => {
  test("returns the whole company list for a ringi:read:all holder", async () => {
    const response = await request({
      path: "/ringi/admin",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(3)
  })

  test("filters by status", async () => {
    const response = await request({
      path: "/ringi/admin?status=pending",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(2)
  })

  test("filters by applicant_id", async () => {
    const response = await request({
      path: "/ringi/admin?applicant_id=10",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { data: Array<{ id: number }>; total: number }

    expect(body.total).toBe(1)
    expect(body.data.at(0)?.id).toBe(3)
  })

  test("returns 403 for an employee without ringi:read:all", async () => {
    const response = await request({
      path: "/ringi/admin",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a token", async () => {
    const response = await request({ path: "/ringi/admin", token: null })

    expect(response.status).toBe(401)
  })
})
