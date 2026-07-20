import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedNotifications } from "@/infrastructure/seed/seed-notifications"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const readAllResponseSchema = z.object({
  updated: z.number(),
})

const jwtSecret = "notification-read-all-route-test-secret"

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

describe("POST /notifications/read-all", () => {
  test("marks all of the caller's notifications read", async () => {
    const response = await request({
      path: "/notifications/read-all",
      token: await tokenFor(5, "member"),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = readAllResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.updated).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/notifications/read-all", token: null, method: "POST" })

    expect(response.status).toBe(401)
  })
})
