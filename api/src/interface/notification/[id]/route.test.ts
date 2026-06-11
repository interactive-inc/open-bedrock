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

const jwtSecret = "notification-detail-route-test-secret"

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

describe("GET /notifications/:id", () => {
  test("returns the caller's own notification", async () => {
    const response = await request({
      path: "/notifications/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = notificationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.recipient_employee_id).toBe(5)
    }
  })

  test("returns 403 for another employee's notification", async () => {
    const response = await request({
      path: "/notifications/4",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing notification", async () => {
    const response = await request({
      path: "/notifications/9999",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/notifications/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /notifications/:id", () => {
  test("deletes the caller's own notification and returns 204", async () => {
    const response = await request({
      path: "/notifications/1",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 404 when deleting another employee's notification", async () => {
    const response = await request({
      path: "/notifications/4",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    // DB-level recipientEmployeeId guard returns 404 instead of 403
    // to avoid leaking existence of other employees' notifications.
    expect(response.status).toBe(404)
  })

  test("returns 404 for a missing notification", async () => {
    const response = await request({
      path: "/notifications/9999",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/notifications/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
