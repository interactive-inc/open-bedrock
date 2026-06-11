import { describe, expect, test } from "bun:test"
import { notificationKindSchema } from "@/domain/notification/notification"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedNotifications } from "@/infrastructure/seed/seed-notifications"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const notificationResponseSchema = z.object({
  id: z.number(),
  recipient_employee_id: z.number(),
  source_domain: z.string(),
  source_id: z.number().nullable(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})

const jwtSecret = "notification-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "notifications",
    seedNotifications.map((notification) => ({
      id: notification.id,
      recipient_employee_id: notification.recipientEmployeeId,
      source_domain: notification.sourceDomain,
      source_id: notification.sourceId,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      is_read: notification.isRead ? 1 : 0,
      created_at: notification.createdAt,
    })),
  )

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
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

describe("POST /notifications", () => {
  test("privileged role sends a notification and returns 201", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: {
        recipient_employee_code: "E005",
        title: "Manual notification",
        kind: "announcement",
      },
    })

    expect(response.status).toBe(201)

    const parsed = notificationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.recipient_employee_id).toBe(5)
      expect(parsed.data.is_read).toBe(false)
      expect(parsed.data.created_at).toBe(fixedNow)
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        recipient_employee_code: "E009",
        title: "Manual notification",
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown recipient_employee_code", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: {
        recipient_employee_code: "E999",
        title: "Manual notification",
      },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when the title is missing", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: { recipient_employee_code: "E005" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when source_id is negative", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: {
        recipient_employee_code: "E005",
        title: "Manual notification",
        source_id: -1,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when source_id is a decimal", async () => {
    const response = await request({
      path: "/notifications",
      token: await tokenFor(1, "admin"),
      method: "POST",
      body: {
        recipient_employee_code: "E005",
        title: "Manual notification",
        source_id: 1.5,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/notifications",
      token: null,
      method: "POST",
      body: {
        recipient_employee_code: "E005",
        title: "Manual notification",
      },
    })

    expect(response.status).toBe(401)
  })
})
