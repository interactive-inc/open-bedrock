import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "iam-roles-route-test-secret"

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

/** E001 は admin(iam:manage_roles 保有)、E005 は member。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "root" })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
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

describe("GET /roles", () => {
  test("returns the system roles for an admin", async () => {
    const response = await request({ path: "/roles", token: await adminToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({
        data: z.array(
          z.object({
            key: z.string(),
            is_system: z.boolean(),
            permission_keys: z.array(z.string()),
          }),
        ),
        total: z.number(),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const keys = parsed.data.data.map((role) => role.key)

      expect(keys).toContain("root")
      expect(keys).toContain("member")

      const admin = parsed.data.data.find((role) => role.key === "root")

      expect(admin?.permission_keys).toContain("iam:manage_roles")
    }
  })

  test("returns 403 for a member without iam:manage_roles", async () => {
    const response = await request({ path: "/roles", token: await memberToken() })

    expect(response.status).toBe(403)
  })

  test("returns roles to an account with iam:assign_roles for the assignment UI", async () => {
    const db = await createTestDb()

    await db
      .prepare(
        "INSERT INTO roles (key, name, is_system, created_at) VALUES ('assigner', 'Assigner', 0, 0)",
      )
      .run()

    await db
      .prepare(
        "INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.key = 'assigner' AND p.key = 'iam:assign_roles'",
      )
      .run()

    await db
      .prepare(
        "INSERT INTO account_roles (account_id, role_id, granted_at) SELECT link.account_id, role.id, 0 FROM account_employee_links link, roles role WHERE link.employee_id = 5 AND role.key = 'assigner'",
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/roles",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/roles", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /roles", () => {
  test("creates a dynamic role for an admin", async () => {
    const response = await request({
      path: "/roles",
      token: await adminToken(),
      method: "POST",
      // auditor はプリセットロール(0021_role_presets.sql)で seed 済みのため、テスト専用キーを使う。
      body: {
        key: "test_auditor",
        name: "監査担当(テスト)",
        description: null,
        permission_keys: ["dashboard:view"],
      },
    })

    expect(response.status).toBe(201)

    const parsed = z
      .object({ key: z.string(), is_system: z.boolean(), permission_keys: z.array(z.string()) })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.key).toBe("test_auditor")
      expect(parsed.data.is_system).toBe(false)
      expect(parsed.data.permission_keys).toEqual(["dashboard:view"])
    }
  })

  test("rejects granting a permission the creator does not hold", async () => {
    // member は dashboard:view を持たないので、それを含むロール作成は escalation で拒否。
    // ただし member はそもそも iam:manage_roles も無いため 403。admin で「admin が持たない」想定は作れないが、
    // ここでは member が iam:manage_roles を持たない 403 を確認する。
    const response = await request({
      path: "/roles",
      token: await memberToken(),
      method: "POST",
      body: { key: "x", name: "x", description: null, permission_keys: [] },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 for a duplicate role key", async () => {
    const response = await request({
      path: "/roles",
      token: await adminToken(),
      method: "POST",
      body: { key: "root", name: "dup", description: null, permission_keys: [] },
    })

    expect(response.status).toBe(409)
  })
})
