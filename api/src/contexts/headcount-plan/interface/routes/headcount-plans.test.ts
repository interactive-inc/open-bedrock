import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "headcount-plan-route-test-secret"

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

  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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
    token: await tokenFor(1),
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
      token: await tokenFor(1),
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

  test("company-wide plan (null department) uses total active headcount", async () => {
    const db = await createTestDb()

    await createPlan(db, { fiscal_year: 2026, department_code: null, planned_count: 20 })

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(1),
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
      token: await tokenFor(1),
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
      token: await tokenFor(5),
    })

    expect(response.status).toBe(403)
  })

  test("member without manage cannot create", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/headcount-plans",
      token: await tokenFor(5),
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
