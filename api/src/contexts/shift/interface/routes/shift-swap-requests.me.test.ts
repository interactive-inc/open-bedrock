import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftSwapRequests } from "@/contexts/shift/test/seed/seed-shift-swap-requests.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "shift-swap-requests-me-route-test-secret"

const myShiftSwapRequestResponseSchema = z.object({
  id: z.number(),
  requester_employee_id: zEmployeeId,
  target_employee_id: zEmployeeId,
  target_employee_name: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

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
    "shift_swap_requests",
    seedShiftSwapRequests.map((swapRequest) => ({
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
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

type RequestProps = {
  path: string
  token: string | null
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
  })
}

describe("GET /shift-swap-requests/me", () => {
  test("returns the caller's own requests with the target employee's name filled in", async () => {
    // seed id=1: requester=5, target=4（Drew Sato）
    const response = await request({
      path: "/shift/shift-swap-requests/me",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(myShiftSwapRequestResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.requester_employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.data[0]?.target_employee_id).toBe(toWorkforceEmployeeId(4))
      // member は社員 ID から氏名を引けないため、交代相手の氏名を埋めて返す
      expect(parsed.data.data[0]?.target_employee_name).toBe("Drew Sato")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift/shift-swap-requests/me", token: null })

    expect(response.status).toBe(401)
  })
})
