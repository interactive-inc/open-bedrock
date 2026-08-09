import { describe, expect, test } from "bun:test"
import { companyNotificationKindSchema } from "@/domain/company/notifications/notification-kind"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedNotifications } from "@/infrastructure/seed/seed-notifications"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const notificationResponseSchema = z.object({
  id: z.number(),
  recipient_employee_id: z.number(),
  source_domain: z.string(),
  source_id: z.number().nullable(),
  kind: companyNotificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})

const jwtSecret = "notification-me-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "notifications",
    seedNotifications.map((notification) => ({
      id: notification.id,
      recipient_account_id: notification.recipientEmployeeId,
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
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

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

describe("GET /notifications/me", () => {
  test("returns the caller's notifications newest first", async () => {
    const response = await request({
      path: "/notifications/me",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
      expect(parsed.data.data[0]?.id).toBe(3)
    }
  })

  test("filters by is_read=false", async () => {
    const response = await request({
      path: "/notifications/me?is_read=false",
      token: await tokenFor(5, "member"),
    })

    const parsed = z
      .object({ data: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
    }
  })

  test("applies limit", async () => {
    const response = await request({
      path: "/notifications/me?limit=1",
      token: await tokenFor(5, "member"),
    })

    const parsed = z
      .object({ data: z.array(notificationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(3)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/notifications/me", token: null })

    expect(response.status).toBe(401)
  })
})
