import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/infrastructure/seed/seed-goal-evaluations"
import { seedGoals } from "@/infrastructure/seed/seed-goals"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const goalResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

const jwtSecret = "goal-list-route-test-secret"

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
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "goals",
    seedGoals.map((goal) => ({
      id: goal.id,
      employee_id: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
    })),
  )

  await seedD1(
    db,
    "goal_evaluations",
    seedGoalEvaluations.map((evaluation) => ({
      id: evaluation.id,
      goal_id: evaluation.goalId,
      evaluator_id: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      created_at: evaluation.createdAt,
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

describe("GET /goals", () => {
  test("returns 200 with the viewer's own goals by default", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === 5)).toBe(true)
    }
  })

  test("filters own goals by period", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?period=2025-H2",
      token: await tokenFor(9, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe(4)
    }
  })

  test("privileged role can read another employee via employee_id", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=5",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === 5)).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=9",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("manager can read a report's goals (E004 over E005)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=5",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((goal) => goal.employee_id === 5)).toBe(true)
    }
  })

  test("manager cannot read a non-report's goals (E004 not over E009)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals?employee_id=9",
      token: await tokenFor(4, "manager"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: null,
    })

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/goals",
      token: "not-a-real-token",
    })

    expect(response.status).toBe(401)
  })
})

/**
 * scope=reports 用に、manager(id2)が id20/id21 の 2 名を配下に持つ小さな組織を組む。
 * seed 側は manager が 1 名しか配下を持たないため、ここで専用データを用意する。
 */
const scopeEmployeeRows = [
  { id: 2, code: "M002", name: "Mgr", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", name: "ReportA", email: "you+r020@example.com", role: "member" },
  { id: 21, code: "R021", name: "ReportB", email: "you+r021@example.com", role: "member" },
  { id: 22, code: "S022", name: "Solo", email: "you+s022@example.com", role: "manager" },
]

async function createScopeTestDb(): Promise<D1Database> {
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

  await seedD1(db, "goals", [
    {
      id: 100,
      employee_id: 20,
      period: "2025-H2",
      title: "A goal",
      kpi: null,
      weight: 50,
      status: "draft",
    },
    {
      id: 101,
      employee_id: 21,
      period: "2025-H2",
      title: "B goal",
      kpi: null,
      weight: 50,
      status: "draft",
    },
  ])

  return db
}

describe("GET /goals?scope=reports", () => {
  test("manager gets goals of all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=reports",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data.map((goal) => goal.employee_id).sort((a, b) => a - b)

      expect(employeeIds).toEqual([20, 21])
    }
  })

  test("manager with no reports gets an empty list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=reports",
      token: await tokenFor(22, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(0)
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("member requesting scope=reports is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=reports",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })
})

/** scope=department 用に、D002 側の goal を足して部署ごとの分離を確認する。 */
async function createDepartmentScopeTestDb(): Promise<D1Database> {
  const db = await createScopeTestDb()

  // 全社権限の検証用に admin(id 23、所属なし)を追加する。
  await seedD1(db, "employees", [
    {
      id: 23,
      code: "A023",
      name: "Admin",
      dept_id: 1,
      dept_name: "Dept",
      position: "-",
      status: "active",
    },
  ])

  await seedIamForEmployees(db, [
    { id: 23, email: "you+a023@example.com", passwordHash: "x", role: "root" },
  ])

  await seedD1(db, "goals", [
    {
      id: 102,
      employee_id: 22,
      period: "2025-H2",
      title: "C goal",
      kpi: null,
      weight: 50,
      status: "draft",
    },
  ])

  return db
}

/** goal:read:department だけを持つカスタムロールを対象アカウントへ付与する。 */
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
       SELECT 900, p.id FROM permissions p WHERE p.key = 'goal:read:department'`,
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

describe("GET /goals?scope=department", () => {
  test("admin lists only the requested department's goals", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=department&department_code=D001",
      token: await tokenFor(23, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data.map((goal) => goal.employee_id).sort((a, b) => a - b)

      expect(employeeIds).toEqual([20, 21])
    }
  })

  test("department reader in the department lists its goals", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/goals?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
    }
  })

  test("department reader outside the department is forbidden", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/goals?scope=department&department_code=D002",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("member without department permission is forbidden", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=department&department_code=D001",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("missing department_code is unprocessable", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/goals?scope=department",
      token: await tokenFor(23, "root"),
    })

    expect(response.status).toBe(422)
  })
})
