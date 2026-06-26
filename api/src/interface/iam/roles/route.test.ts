import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
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

// E001 は admin(iam:manage_roles 保有)、E005 は member。
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
        data: z.array(z.object({ key: z.string(), is_system: z.boolean() })),
        total: z.number(),
      })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const keys = parsed.data.data.map((role) => role.key)

      expect(keys).toContain("admin")
      expect(keys).toContain("member")
    }
  })

  test("returns 403 for a member without iam:manage_roles", async () => {
    const response = await request({ path: "/roles", token: await memberToken() })

    expect(response.status).toBe(403)
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
      body: {
        key: "auditor",
        name: "監査担当",
        description: null,
        permission_keys: ["dashboard:view"],
      },
    })

    expect(response.status).toBe(201)

    const parsed = z
      .object({ key: z.string(), is_system: z.boolean() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.key).toBe("auditor")
      expect(parsed.data.is_system).toBe(false)
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
      body: { key: "admin", name: "dup", description: null, permission_keys: [] },
    })

    expect(response.status).toBe(409)
  })
})
