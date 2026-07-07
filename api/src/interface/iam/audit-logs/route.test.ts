import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "iam-audit-logs-route-test-secret"

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

  await seedD1(db, "audit_logs", [
    {
      id: 1,
      actor_account_id: 1,
      action: "account.status.change",
      target_type: "account",
      target_id: 5,
      metadata: '{"status":"suspended"}',
      ip: "203.0.113.1",
      created_at: Date.parse("2026-01-01T00:00:00.000Z"),
    },
    {
      id: 2,
      actor_account_id: 1,
      action: "role.grant",
      target_type: "account",
      target_id: 6,
      metadata: null,
      ip: null,
      created_at: Date.parse("2026-01-02T00:00:00.000Z"),
    },
    {
      id: 3,
      actor_account_id: 2,
      action: "account.status.change",
      target_type: "account",
      target_id: 7,
      metadata: null,
      ip: null,
      created_at: Date.parse("2026-01-03T00:00:00.000Z"),
    },
  ])

  return db
}

// E001 は admin(audit_log:read 保有)、E005 は member。
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "admin" })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

const auditLogListSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      actor_account_id: z.number().nullable(),
      action: z.string(),
      target_type: z.string().nullable(),
      target_id: z.number().nullable(),
      metadata: z.string().nullable(),
      ip: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  total: z.number(),
})

async function request(props: { path: string; token: string | null }): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
  })
}

describe("GET /audit-logs", () => {
  test("returns audit logs newest first for an admin", async () => {
    const response = await request({ path: "/audit-logs", token: await adminToken() })

    expect(response.status).toBe(200)

    const parsed = auditLogListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(3)

      const ids = parsed.data.data.map((entry) => entry.id)

      expect(ids).toEqual([3, 2, 1])
    }
  })

  test("filters by action", async () => {
    const response = await request({
      path: "/audit-logs?action=account.status.change",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)

    const parsed = auditLogListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const actions = parsed.data.data.map((entry) => entry.action)

      expect(actions.every((action) => action === "account.status.change")).toBe(true)
    }
  })

  test("filters by actor_account_id and target_type", async () => {
    const response = await request({
      path: "/audit-logs?actor_account_id=2&target_type=account",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)

    const parsed = auditLogListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data.at(0)?.id).toBe(3)
    }
  })

  test("filters by from/to date range", async () => {
    const response = await request({
      path: "/audit-logs?from=2026-01-02T00:00:00.000Z&to=2026-01-02T23:59:59.999Z",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)

    const parsed = auditLogListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data.at(0)?.id).toBe(2)
    }
  })

  test("returns 403 for a member without audit_log:read", async () => {
    const response = await request({ path: "/audit-logs", token: await memberToken() })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/audit-logs", token: null })

    expect(response.status).toBe(401)
  })
})
