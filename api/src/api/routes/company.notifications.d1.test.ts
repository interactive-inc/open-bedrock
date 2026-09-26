import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { companyNotificationKindSchema } from "@/api/http/notifications/notification-kind.definition"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedSystemNotifications } from "@tests/api/support/seed-notifications"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(7)
})

afterAll(async () => {
  await pool.dispose()
})

const notificationResponseSchema = z.object({
  id: z.uuid(),
  recipient_employee_id: zEmployeeId,
  source_domain: z.string(),
  source_id: z.number().nullable(),
  kind: companyNotificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})

const jwtSecret = "notification-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)
  await seedSystemNotifications(db)
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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
      path: "/company/notifications",
      token: await tokenFor(1),
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
      expect(parsed.data.recipient_employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.is_read).toBe(false)
      expect(parsed.data.created_at).toBe(fixedNow)
    }
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/company/notifications",
      token: await tokenFor(5),
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
      path: "/company/notifications",
      token: await tokenFor(1),
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
      path: "/company/notifications",
      token: await tokenFor(1),
      method: "POST",
      body: { recipient_employee_code: "E005" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when source_id is negative", async () => {
    const response = await request({
      path: "/company/notifications",
      token: await tokenFor(1),
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
      path: "/company/notifications",
      token: await tokenFor(1),
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
      path: "/company/notifications",
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
