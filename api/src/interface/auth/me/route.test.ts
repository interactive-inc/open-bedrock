import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "auth-me-route-test-secret"

const meResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
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

  return db
}

async function getMe(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/me", token })
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

describe("GET /me", () => {
  test("returns 200 and the employee in CLI whoami shape", async () => {
    const response = await getMe(await adminToken())

    expect(response.status).toBe(200)

    const parsed = meResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.code).toBe("E001")
      expect(parsed.data.email).toBe("you+e001@example.com")
      expect(parsed.data.role).toBe("admin")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getMe(null)

    expect(response.status).toBe(401)
  })

  test("returns 401 for an invalid token", async () => {
    const response = await getMe("not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 401 for an expired token", async () => {
    const expiredToken = await createTestToken(
      jwtSecret,
      { employeeId: 1, email: "you+e001@example.com", role: "admin" },
      // 1 秒前に切れる exp（絶対 epoch 秒）。
      { expirationTime: Math.floor(Date.now() / 1000) - 1 },
    )

    const response = await getMe(expiredToken)

    expect(response.status).toBe(401)
  })

  test("returns 401 when the token employee does not exist", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 9999,
      email: "you+ghost@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(401)
  })

  test("returns 401 for a retired employee with a valid token (#775)", async () => {
    // E018 は seed 上 retired。退職者の既存トークンは即時無効化する。
    const token = await createTestToken(jwtSecret, {
      employeeId: 18,
      email: "you+e018@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(401)
  })

  test("returns 200 for a leave employee with a valid token (#775, leave は現状許可)", async () => {
    // E017 は seed 上 leave。休職中の API 利用は現仕様で許可。
    const token = await createTestToken(jwtSecret, {
      employeeId: 17,
      email: "you+e017@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(200)
  })

  test("returns the effective lifecycle department and position after verification", async () => {
    const db = await createTestDb()
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (4, 'Sales');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D004', 4, NULL, NULL, 1);
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('assignment-1', 1, 'employment-1', 1, 'D004', 'primary', 'Sales Director', NULL,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({ dept_name: "Sales", position: "Sales Director" }),
    )
  })
})
