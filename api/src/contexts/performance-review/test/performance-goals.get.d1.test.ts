import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedGoalEvaluations } from "@/contexts/performance-review/test/seed/seed-goal-evaluations.test-support"
import { seedGoals } from "@/contexts/performance-review/test/seed/seed-goals.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(16)
})

afterAll(async () => {
  await pool.dispose()
})

const goalResponseSchema = z.object({
  id: z.uuid(),
  employee_id: zEmployeeId,
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

const jwtSecret = "goal-list-route-test-secret"

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

  await initializeCompanyMembershipTestState(
    db,
    seedOrgMemberships.map((membership) => ({
      departmentCode: membership.departmentCode,
      employeeCode: membership.employeeCode,
      managerEmployeeCode: membership.managerEmployeeCode,
    })),
  )

  await seedD1(
    db,
    "performance_goals",
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

  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

describe("GET /performance-goals", () => {
  test("returns 200 with the viewer's own goals by default", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
    }
  })

  test("filters own goals by period", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?period=2025-H2",
      token: await tokenFor(9),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.id).toBe("01900030-0000-7000-8000-000000000004")
    }
  })

  test("privileged role can read another employee via employee_id", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?employee_id=5",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.data.every((goal) => goal.employee_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?employee_id=9",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(403)
  })

  test("manager can read a report's goals (E004 over E005)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?employee_id=5",
      token: await tokenFor(4),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((goal) => goal.employee_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
    }
  })

  test("manager cannot read a non-report's goals (E004 not over E009)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?employee_id=9",
      token: await tokenFor(4),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: null,
    })

    expect(response.status).toBe(401)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
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
  {
    id: 23,
    code: "A023",
    name: "Admin",
    email: "you+a023@example.com",
    role: "root",
    departmentId: 1,
  },
]

async function createScopeTestDb(): Promise<D1Database> {
  const db = await pool.next()

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

  await seedD1(db, "performance_goals", [
    {
      id: "01900030-0000-7000-8000-000000000064",
      employee_id: "20",
      period: "2025-H2",
      title: "A goal",
      kpi: null,
      weight: 50,
      status: "draft",
    },
    {
      id: "01900030-0000-7000-8000-000000000065",
      employee_id: "21",
      period: "2025-H2",
      title: "B goal",
      kpi: null,
      weight: 50,
      status: "draft",
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

describe("GET /performance-goals?scope=reports", () => {
  test("manager gets goals of all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?scope=reports",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data
        .map((goal) => goal.employee_id)
        .sort((left, right) => left.localeCompare(right))

      expect(employeeIds).toEqual([toWorkforceEmployeeId(20), toWorkforceEmployeeId(21)])
    }
  })

  test("manager with no reports gets an empty list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?scope=reports",
      token: await tokenFor(22),
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
      path: "/performance-review/performance-goals?scope=reports",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })
})

/** scope=department 用に、D002 側の goal を足して部署ごとの分離を確認する。 */
async function createDepartmentScopeTestDb(): Promise<D1Database> {
  const db = await createScopeTestDb()

  await seedD1(db, "performance_goals", [
    {
      id: "01900030-0000-7000-8000-000000000066",
      employee_id: "22",
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
      `INSERT INTO system_iam_roles
         (id, key, kind, name, description, created_at, updated_at)
       VALUES ('5e0f7c3a-1d2b-4c5d-8e6f-000000000900', 'company:dept_reader', 'custom', 'dept reader', NULL, 0, 0)`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('5e0f7c3a-1d2b-4c5d-8e6f-000000000900', 'goal:read:department')`,
    )
    .run()

  await db
    .prepare(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?2, ?1, '5e0f7c3a-1d2b-4c5d-8e6f-000000000900', NULL, NULL, 0, NULL)`,
    )
    .bind(String(accountId), crypto.randomUUID())
    .run()
}

describe("GET /performance-goals?scope=department", () => {
  test("admin lists only the requested department's goals", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?scope=department&department_code=D001",
      token: await tokenFor(23),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(goalResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const employeeIds = parsed.data.data
        .map((goal) => goal.employee_id)
        .sort((left, right) => left.localeCompare(right))

      expect(employeeIds).toEqual([toWorkforceEmployeeId(20), toWorkforceEmployeeId(21)])
    }
  })

  test("department reader in the department lists its goals", async () => {
    const db = await createDepartmentScopeTestDb()

    await grantDepartmentReader(db, 20)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-review/performance-goals?scope=department&department_code=D001",
      token: await tokenFor(20),
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
      path: "/performance-review/performance-goals?scope=department&department_code=D002",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })

  test("member without department permission is forbidden", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?scope=department&department_code=D001",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })

  test("missing department_code is unprocessable", async () => {
    const response = await requestWithContext({
      db: await createDepartmentScopeTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals?scope=department",
      token: await tokenFor(23),
    })

    expect(response.status).toBe(422)
  })
})
