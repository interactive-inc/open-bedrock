import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedGoalEvaluations } from "@/contexts/performance-review/test/seed/seed-goal-evaluations.test-support"
import { seedGoals } from "@/contexts/performance-review/test/seed/seed-goals.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const goalResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

const jwtSecret = "goal-create-route-test-secret"

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

describe("POST /performance-goals", () => {
  test("creates a goal for the authenticated user and returns 201", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
      method: "POST",
      body: { period: "2026-H2", title: "New goal", weight: 25 },
    })

    expect(response.status).toBe(201)

    const parsed = goalResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.period).toBe("2026-H2")
      expect(parsed.data.title).toBe("New goal")
      expect(parsed.data.weight).toBe(25)
      expect(parsed.data.status).toBe("draft")
      expect(parsed.data.kpi).toBeNull()
    }
  })

  test("defaults weight to 10 when omitted", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
      method: "POST",
      body: { period: "2026-H2", title: "Goal without weight" },
    })

    expect(response.status).toBe(201)

    const parsed = goalResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.weight).toBe(10)
    }
  })

  test("returns 400 when title is missing", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
      method: "POST",
      body: { period: "2026-H2" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: null,
      method: "POST",
      body: { period: "2026-H2", title: "x" },
    })

    expect(response.status).toBe(401)
  })

  test("admin (review:administer) can create a company goal", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(1),
      method: "POST",
      body: { period: "2026-H1", title: "Company OKR", owner_type: "company" },
    })

    expect(response.status).toBe(201)

    const parsed = z
      .object({ owner_type: z.string(), department_code: z.string().nullable() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.owner_type).toBe("company")
      expect(parsed.data.department_code).toBeNull()
    }
  })

  test("member cannot create a company goal", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
      method: "POST",
      body: { period: "2026-H1", title: "Company OKR", owner_type: "company" },
    })

    expect(response.status).toBe(403)
  })

  test("manager of the department can create a department goal for their department", async () => {
    // E004 は manager かつ D003 所属。D003 の部門目標を作成できる。
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(4),
      method: "POST",
      body: {
        period: "2026-H1",
        title: "D003 dept goal",
        owner_type: "department",
        department_code: "D003",
      },
    })

    expect(response.status).toBe(201)

    const parsed = z
      .object({ owner_type: z.string(), department_code: z.string().nullable() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.owner_type).toBe("department")
      expect(parsed.data.department_code).toBe("D003")
    }
  })

  test("manager cannot create a department goal for another department", async () => {
    // manager は review:administer を持たないため、自部門(D003)以外の部門目標は作成できない。
    // review:administer 保持者(hr/admin)による作成は admin のテストで担保する。
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(4),
      method: "POST",
      body: {
        period: "2026-H1",
        title: "D004 dept goal",
        owner_type: "department",
        department_code: "D004",
      },
    })

    expect(response.status).toBe(403)
  })

  test("member cannot create a department goal", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals",
      token: await tokenFor(5),
      method: "POST",
      body: {
        period: "2026-H1",
        title: "D003 dept goal",
        owner_type: "department",
        department_code: "D003",
      },
    })

    expect(response.status).toBe(403)
  })
})
