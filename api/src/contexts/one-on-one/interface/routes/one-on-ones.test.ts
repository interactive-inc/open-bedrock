import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOneOnOnes } from "@/contexts/one-on-one/test/seed/seed-one-on-ones.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
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
  await initializeStandardCompanyTestState(db)

  return db
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(4),
  })
}

async function getRequest(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/one-on-ones", token })
}

async function postOneOnOne(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/one-on-ones",
    token,
    method: "POST",
    body,
    now: "2026-05-29T09:00:00Z",
  })
}

describe("GET /one-on-ones", () => {
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
      expect(session?.topics).toBe("目標の進捗とキャリアの方向性")
    }
  })

  test("returns an empty array for an employee with no sessions", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: toWorkforceEmployeeId(1),
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

describe("POST /one-on-ones", () => {
  test("returns 201 when the member is selected by employee code", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_employee_code: "E005",
      topics: "Next challenge",
    })

    expect(response.status).toBe(201)
  })

  test("returns 201 and resolves member/manager into snake_case shape", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_employee_code: "E005",
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
      member_employee_code: "E005",
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when member_employee_code is missing", async () => {
    const response = await postOneOnOne(await managerToken(), { topics: "body only" })

    expect(response.status).toBe(400)
  })

  test("returns 400 when member and manager are the same person", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_employee_code: "E004",
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 when the member code is unknown", async () => {
    const response = await postOneOnOne(await managerToken(), {
      member_employee_code: "UNKNOWN",
    })

    expect(response.status).toBe(404)
  })
})

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

const scopeEmployeeRows = [
  {
    id: 2,
    code: "M002",
    name: "Mgr",
    email: "you+m002@example.com",
    role: "manager",
    departmentId: 1,
  },
  {
    id: 20,
    code: "R020",
    name: "ReportA",
    email: "you+r020@example.com",
    role: "member",
    departmentId: 1,
  },
  {
    id: 21,
    code: "R021",
    name: "ReportB",
    email: "you+r021@example.com",
    role: "member",
    departmentId: 1,
  },
  {
    id: 22,
    code: "S022",
    name: "Solo",
    email: "you+s022@example.com",
    role: "manager",
    departmentId: 2,
  },
]

async function createDepartmentScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.departmentId,
      deptName: "Dept",
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

  await seedD1(db, "one_on_ones", [
    {
      id: "dept-001",
      member_id: "20",
      manager_id: "2",
      held_at: "2026-06-01T05:00:00Z",
      topics: "D001 session A",
      manager_note: "internal note A",
      next_action: "action A",
    },
    {
      id: "dept-002",
      member_id: "21",
      manager_id: "2",
      held_at: "2026-06-08T05:00:00Z",
      topics: "D001 session B",
      manager_note: "internal note B",
      next_action: "action B",
    },
    {
      id: "dept-003",
      member_id: "22",
      manager_id: "22",
      held_at: "2026-06-10T05:00:00Z",
      topics: "D002 session",
      manager_note: null,
      next_action: null,
    },
  ])

  await initializeCompanyTestFixture({
    db,
    employees: scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.departmentId,
      status: "active",
    })),
    departments: [
      { id: 1, code: "D001", name: "Dept One", managerEmployeeCode: "M002" },
      { id: 2, code: "D002", name: "Dept Two", managerEmployeeCode: "S022" },
    ],
    memberships: [
      { departmentCode: "D001", employeeCode: "M002", managerEmployeeCode: null },
      { departmentCode: "D001", employeeCode: "R020", managerEmployeeCode: "M002" },
      { departmentCode: "D001", employeeCode: "R021", managerEmployeeCode: "M002" },
      { departmentCode: "D002", employeeCode: "S022", managerEmployeeCode: null },
    ],
  })

  return db
}

async function grantDepartmentReader(db: D1Database, accountId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_iam_roles
         (id, key, kind, name, description, created_at, updated_at)
       VALUES ('900', 'company:dept_reader', 'custom', 'dept reader', NULL, 0, 0)`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('900', 'oneonone:read:department')`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES ('test:department-reader:' || ?1, ?1, '900', NULL, NULL, 0, NULL)`,
    )
    .bind(String(accountId))
    .run()
}

describe("GET /one-on-ones?scope=department", () => {
  test("department reader in the department lists its 1on1s", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/one-on-ones?scope=department&department_code=D001",
      token: await tokenFor(20),
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
      path: "/one-on-ones?scope=department&department_code=D002",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })

  test("member without department permission is forbidden", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/one-on-ones?scope=department&department_code=D001",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })

  test("missing department_code is unprocessable", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/one-on-ones?scope=department",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(422)
  })
})
