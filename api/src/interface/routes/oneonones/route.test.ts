import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOneOnOnes } from "@/infrastructure/seed/seed-one-on-ones"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const oneOnOneResponseSchema = z.object({
  id: z.string(),
  held_at: z.string(),
  member_name: z.string(),
  manager_name: z.string(),
  topics: z.string().nullable(),
  manager_note: z.string().nullable(),
  next_action: z.string().nullable(),
})

const jwtSecret = "one-on-one-route-test-secret"

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
    "one_on_ones",
    seedOneOnOnes.map((oneOnOne) => ({
      id: oneOnOne.id,
      member_id: oneOnOne.memberId,
      manager_id: oneOnOne.managerId,
      held_at: oneOnOne.heldAt,
      topics: oneOnOne.topics,
      manager_note: oneOnOne.managerNote,
      next_action: oneOnOne.nextAction,
    })),
  )

  return db
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
  })
}

async function getRequest(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/oneonones", token })
}

async function postOneOnOne(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/oneonones",
    token,
    method: "POST",
    body,
    now: "2026-05-29T09:00:00Z",
  })
}

describe("GET /oneonones", () => {
  test("returns 200 with the participant's history in snake_case shape", async () => {
    const response = await getRequest(await managerToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(oneOnOneResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const session = parsed.data.data.find((row) => row.held_at === "2026-05-01T05:00:00Z")

      expect(session?.member_name).toBe("Emery Lane")
      expect(session?.manager_name).toBe("Drew Sato")
      expect(session?.topics).toBe("Goal progress and career direction")
    }
  })

  test("returns an empty array for an employee with no sessions", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 1,
      email: "you+e001@example.com",
      role: "root",
    })

    const response = await getRequest(token)

    expect(response.status).toBe(200)

    expect(await response.json()).toEqual({ data: [], total: 0 })
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest(null)

    expect(response.status).toBe(401)
  })
})

describe("POST /oneonones", () => {
  test("returns 201 when the member is selected by employee code", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_employee_code: "E005",
      topics: "Next challenge",
    })

    expect(response.status).toBe(201)
  })

  test("returns 201 and resolves member/manager into snake_case shape", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+e005@example.com",
      topics: "Next challenge",
    })

    expect(response.status).toBe(201)

    const parsed = oneOnOneResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.member_name).toBe("Emery Lane")
      expect(parsed.data.manager_name).toBe("Drew Sato")
      expect(parsed.data.held_at).toBe("2026-05-29T09:00:00Z")
      expect(parsed.data.topics).toBe("Next challenge")
      expect(parsed.data.manager_note).toBeNull()
      expect(parsed.data.next_action).toBeNull()
      expect(parsed.data.id.length).toBeGreaterThan(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await postOneOnOne(null, {
      member_email: "you+e005@example.com",
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when member_email is missing", async () => {
    const response = await postOneOnOne(await managerToken(), { topics: "body only" })

    expect(response.status).toBe(400)
  })

  test("returns 400 when member and manager are the same person", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+e004@example.com",
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the member email is unknown", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_email: "you+ghost@example.com",
    })

    expect(response.status).toBe(404)
  })
})

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

const scopeEmployeeRows = [
  { id: 2, code: "M002", name: "Mgr", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", name: "ReportA", email: "you+r020@example.com", role: "member" },
  { id: 21, code: "R021", name: "ReportB", email: "you+r021@example.com", role: "member" },
  { id: 22, code: "S022", name: "Solo", email: "you+s022@example.com", role: "manager" },
]

async function createDepartmentScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: 1,
      dept_name: "Dept",
      position: "-",
      status: "active",
    })),
  )

  await seedIamForEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D001", employee_code: "R021", manager_employee_code: "M002" },
    { department_code: "D002", employee_code: "S022", manager_employee_code: null },
  ])

  await seedD1(db, "one_on_ones", [
    {
      id: "dept-001",
      member_id: 20,
      manager_id: 2,
      held_at: "2026-06-01T05:00:00Z",
      topics: "D001 session A",
      manager_note: "internal note A",
      next_action: "action A",
    },
    {
      id: "dept-002",
      member_id: 21,
      manager_id: 2,
      held_at: "2026-06-08T05:00:00Z",
      topics: "D001 session B",
      manager_note: "internal note B",
      next_action: "action B",
    },
    {
      id: "dept-003",
      member_id: 22,
      manager_id: 22,
      held_at: "2026-06-10T05:00:00Z",
      topics: "D002 session",
      manager_note: null,
      next_action: null,
    },
  ])

  return db
}

async function grantDepartmentReader(db: D1Database, accountId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO roles (id, key, name, description, is_system, created_at)
       VALUES (900, 'dept_reader', 'dept reader', '', 0, 0)`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT 900, p.id FROM permissions p WHERE p.key = 'oneonone:read:department'`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
       VALUES (?1, 900, NULL, 0)`,
    )
    .bind(accountId)
    .run()
}

describe("GET /oneonones?scope=department", () => {
  test("department reader in the department lists its 1on1s", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/oneonones?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(oneOnOneResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      // 部署スコープでは manager_note は null になる。
      expect(parsed.data.data.every((row) => row.manager_note === null)).toBe(true)
    }
  })

  test("department reader outside the department is forbidden", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/oneonones?scope=department&department_code=D002",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("member without department permission is forbidden", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/oneonones?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("missing department_code is unprocessable", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/oneonones?scope=department",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(422)
  })
})
