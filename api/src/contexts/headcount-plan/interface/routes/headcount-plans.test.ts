import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedOrgMemberships } from "@/contexts/company-compatibility/infrastructure/seed/seed-org-memberships"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"

const jwtSecret = "headcount-plan-route-test-secret"

async function createTestDb(verifyCompany = true): Promise<D1Database> {
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

  if (verifyCompany) await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

async function createPlan(
  db: D1Database,
  body: { fiscal_year: number; department_code?: string | null; planned_count: number },
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/headcount-plans",
    token: await tokenFor(1, "root"),
    method: "POST",
    body,
  })
}

describe("headcount plans", () => {
  test("read:all lists plans with the department's active headcount attached", async () => {
    const db = await createTestDb()

    // D003(Engineering)には基準日時点で active な E004・E005・E006 が所属する。
    const created = await createPlan(db, {
      fiscal_year: 2026,
      department_code: "D003",
      planned_count: 4,
    })

    expect(created.status).toBe(201)

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(1, "root"),
    })

    expect(list.status).toBe(200)

    const body = (await list.json()) as {
      data: Array<{ department_code: string | null; planned_count: number; actual_count: number }>
      total: number
    }

    expect(body.total).toBe(1)

    expect(body.data[0]?.planned_count).toBe(4)

    expect(body.data[0]?.actual_count).toBe(3)
  })

  test("fails closed before the Company migration is verified", async () => {
    const db = await createTestDb(false)
    await createPlan(db, { fiscal_year: 2026, department_code: "D003", planned_count: 4 })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(503)
  })

  test("company-wide plan (null department) uses total active headcount", async () => {
    const db = await createTestDb()

    await createPlan(db, { fiscal_year: 2026, department_code: null, planned_count: 20 })

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(1, "root"),
    })

    const body = (await list.json()) as { data: Array<{ actual_count: number }> }

    // seed の active 従業員数（leave/retired を除く）。
    const activeCount = seedEmployees.filter((employee) => employee.status === "active").length

    expect(body.data[0]?.actual_count).toBe(activeCount)
  })

  test("duplicate (fiscal_year, department_code) is a 409 conflict", async () => {
    const db = await createTestDb()

    const first = await createPlan(db, {
      fiscal_year: 2026,
      department_code: "D003",
      planned_count: 4,
    })

    expect(first.status).toBe(201)

    const second = await createPlan(db, {
      fiscal_year: 2026,
      department_code: "D003",
      planned_count: 5,
    })

    expect(second.status).toBe(409)
  })

  test("manage updates the planned count via PUT", async () => {
    const db = await createTestDb()

    const created = await createPlan(db, {
      fiscal_year: 2026,
      department_code: "D003",
      planned_count: 4,
    })

    const plan = (await created.json()) as { id: number }

    const updated = await requestWithContext({
      db,
      jwtSecret,
      path: `/headcount-plans/${plan.id}`,
      token: await tokenFor(1, "root"),
      method: "PUT",
      body: { planned_count: 6 },
    })

    expect(updated.status).toBe(200)

    const updatedBody = (await updated.json()) as { planned_count: number }

    expect(updatedBody.planned_count).toBe(6)
  })

  test("member without read:all cannot list", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("member without manage cannot create", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { fiscal_year: 2026, department_code: "D003", planned_count: 4 },
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/headcount-plans",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})
