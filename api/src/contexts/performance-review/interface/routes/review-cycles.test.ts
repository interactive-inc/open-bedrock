import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedReviewCycles } from "@/contexts/performance-review/test/seed/seed-review-cycles.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"

const jwtSecret = "review-cycles-period-format-route-test-secret"

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
    "review_cycles",
    seedReviewCycles.map((cycle) => ({
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    })),
  )

  await initializeStandardCompanyTestState(db)

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(1),
  })
}

async function createCycle(period: string): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/review-cycles",
    token: await adminToken(),
    method: "POST",
    body: { title: "期間書式の検証", period },
  })
}

async function updateCycle(period: string): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/review-cycles/3",
    token: await adminToken(),
    method: "PUT",
    body: { title: "期間書式の検証", period },
  })
}

/** 目標とサイクルは period 文字列だけで突き合わせるため、揺れた表記を入口で弾く。 */
const malformed = [
  "2026-h1", // 小文字
  "2026-H3", // 存在しない半期
  "2026-H0",
  "26-H1", // 年が 2 桁
  "2026-Q1", // 四半期表記
  "2026-H1 ", // 末尾の空白
  " 2026-H1",
  "2026-H12",
  "2026",
  "",
]

describe("POST /review-cycles の期間書式", () => {
  test("accepts YYYY-H1 and YYYY-H2", async () => {
    for (const period of ["2026-H1", "2026-H2", "1999-H2"]) {
      const response = await createCycle(period)

      expect(response.status).toBe(201)
    }
  })

  test("rejects a malformed period", async () => {
    for (const period of malformed) {
      const response = await createCycle(period)

      expect(response.status).toBe(400)
    }
  })
})

describe("PUT /review-cycles/:cycleId の期間書式", () => {
  test("accepts YYYY-H1 and YYYY-H2", async () => {
    const response = await updateCycle("2027-H1")

    expect(response.status).toBe(200)
  })

  test("rejects a malformed period", async () => {
    for (const period of malformed) {
      const response = await updateCycle(period)

      expect(response.status).toBe(400)
    }
  })
})
